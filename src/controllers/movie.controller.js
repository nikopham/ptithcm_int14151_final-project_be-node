const { prisma } = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response.util");
const {
  importMovieFromTmdb,
  importTvShowFromTmdb,
} = require("../services/tmdb-importer.service");
const axios = require("axios");
const { Prisma } = require("@prisma/client");
const { formatDuration } = require("../helpers/movieFormatters");
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const getImageUrl = (path) =>
  path ? `https://image.tmdb.org/t/p/original${path}` : null;

exports.getTmdbDetailsForForm = async (req, res) => {
  const { tmdbId, type } = req.query; // 'movie' hoặc 'tv'

  if (!tmdbId || !type) {
    return sendError(res, 400, "Cần 'tmdbId' và 'type'.");
  }

  try {
    let movieData,
      creditsData,
      episodes = [];

    if (type === "movie") {
      const [movieRes, creditsRes] = await Promise.all([
        axios.get(
          `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=vi-VN`
        ),
        axios.get(
          `${TMDB_BASE_URL}/movie/${tmdbId}/credits?api_key=${TMDB_API_KEY}`
        ),
      ]);
      movieData = movieRes.data;
      creditsData = creditsRes.data;

      // Phim lẻ chỉ có 1 "tập"
      episodes = [
        {
          tmdb_id: movieData.id,
          title: "Full Movie",
          episode_number: 1,
          season_number: 1,
          duration: movieData.runtime,
          videoSources: [], // Để admin tự điền
        },
      ];
    } else {
      // type === 'tv'
      const [tvRes, creditsRes] = await Promise.all([
        axios.get(
          `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=vi-VN`
        ),
        axios.get(
          `${TMDB_BASE_URL}/tv/${tmdbId}/credits?api_key=${TMDB_API_KEY}`
        ),
      ]);
      movieData = tvRes.data;
      creditsData = creditsRes.data;

      // Lấy tất cả các tập
      for (const season of movieData.seasons) {
        if (season.season_number === 0) continue; // Bỏ qua Specials
        const seasonRes = await axios.get(
          `${TMDB_BASE_URL}/tv/${tmdbId}/season/${season.season_number}?api_key=${TMDB_API_KEY}&language=vi-VN`
        );
        seasonRes.data.episodes.forEach((ep) => {
          episodes.push({
            tmdb_id: ep.id,
            title: `S${ep.season_number} E${ep.episode_number}: ${ep.name}`,
            episode_number: ep.episode_number,
            season_number: ep.season_number,
            duration: ep.runtime || movieData.episode_run_time[0] || 0,
            videoSources: [], // Để admin tự điền
          });
        });
      }
    }

    // Lọc Diễn viên, Đạo diễn, Thể loại, Quốc gia
    const directors = (
      type === "movie"
        ? creditsData.crew.filter((c) => c.job === "Director")
        : movieData.created_by
    ).map((d) => ({
      tmdb_id: d.id,
      name: d.name,
      avatar_url: getImageUrl(d.profile_path),
    }));
    const actors = creditsData.cast.slice(0, 10).map((a) => ({
      tmdb_id: a.id,
      name: a.name,
      avatar_url: getImageUrl(a.profile_path),
    }));
    const genres = movieData.genres.map((g) => ({
      tmdb_id: g.id,
      name: g.name,
    }));
    const country = movieData.production_countries[0]
      ? {
          iso_id: movieData.production_countries[0].iso_3166_1,
          name: movieData.production_countries[0].name,
        }
      : null;

    // Trả về payload hoàn chỉnh cho form
    const formData = {
      tmdb_id: movieData.id,
      title: movieData.title || movieData.name,
      description: movieData.overview,
      imdb_score: movieData.vote_average,
      type: type,
      status: "pending", // Mặc định
      release_year: new Date(
        movieData.release_date || movieData.first_air_date
      ).getFullYear(),
      duration:
        movieData.runtime ||
        (movieData.episode_run_time ? movieData.episode_run_time[0] : 0) ||
        0,
      poster_url: getImageUrl(movieData.poster_path),
      banner_url: getImageUrl(movieData.backdrop_path),
      genres: genres,
      actors: actors,
      directors: directors,
      country: country,
      total_episodes: movieData.number_of_episodes,
      episodes: episodes,
    };

    return sendSuccess(res, 200, "Lấy chi tiết thành công", formData);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi khi lấy chi tiết TMDb");
  }
};

exports.createMovieFromForm = async (req, res) => {
  const body = req.body; // body chính là 'form' state từ frontend

  try {
    const existingMovie = await prisma.movie.findUnique({
      where: { tmdb_id: body.tmdb_id },
    });
    if (existingMovie) {
      return sendError(res, 409, "Phim này đã tồn tại trong CSDL.");
    }

    const newMovie = await prisma.$transaction(async (tx) => {
      // 1. Tạo phim
      const movie = await tx.movie.create({
        data: {
          tmdb_id: body.tmdb_id,
          title: body.title,
          description: body.description,
          type: body.type,
          status: body.status, // 'pending' hoặc 'published'
          total_episodes: body.total_episodes || (body.type === "tv" ? 1 : 0),
          imdb_score: body.imdb_score,
          release_year: body.release_year,
          duration: body.duration,
          poster_url: body.poster_url,
          banner_url: body.banner_url,
          country: body.country
            ? {
                connectOrCreate: {
                  where: { iso_id: body.country.iso_id },
                  create: body.country,
                },
              }
            : undefined,
          movieGenres: {
            create: body.genres.map((g) => ({
              genre: {
                connectOrCreate: { where: { tmdb_id: g.tmdb_id }, create: g },
              },
            })),
          },
          movieActors: {
            create: body.actors.map((a) => ({
              actor: {
                connectOrCreate: { where: { tmdb_id: a.tmdb_id }, create: a },
              },
            })),
          },
          movieDirectors: {
            create: body.directors.map((d) => ({
              director: {
                connectOrCreate: { where: { tmdb_id: d.tmdb_id }, create: d },
              },
            })),
          },
        },
      });

      // 2. Tạo các Tập phim (Episode) và Nguồn (VideoSource)
      for (const ep of body.episodes) {
        // Chỉ tạo tập nếu nó có ít nhất 1 nguồn video
        if (ep.videoSources && ep.videoSources.length > 0) {
          const validSources = ep.videoSources.filter(
            (s) => s.video_url && s.video_url.trim() !== ""
          );
          if (validSources.length > 0) {
            await tx.episode.create({
              data: {
                movie_id: movie.id,
                tmdb_id: ep.tmdb_id,
                title: ep.title,
                season_number: ep.season_number,
                episode_number: ep.episode_number,
                duration: ep.duration,
                videoSources: {
                  create: validSources.map((source) => ({
                    video_url: source.video_url,
                    quality: source.quality,
                    label: source.label,
                  })),
                },
              },
            });
          }
        }
      }

      return movie;
    });

    const result = { ...newMovie, view_count: newMovie.view_count.toString() };
    return sendSuccess(res, 201, "Tạo phim thành công!", result);
  } catch (e) {
    console.error(e);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return sendError(res, 409, "Phim này đã tồn tại.");
      }
    }
    return sendError(res, 500, "Lỗi máy chủ khi tạo phim.");
  }
};

exports.getMoviesForAdmin = async (req, res) => {
  try {
    // 1. Lấy tham số (ĐÃ CẬP NHẬT)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // --- THÊM 'actor_id' VÀO ĐÂY ---
    const { status, type, search, release_year, country_id, actor_id } =
      req.query;

    // 2. Xây dựng 'where' (ĐÃ CẬP NHẬT)
    const where = {};
    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }
    if (status) {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }
    if (release_year) {
      where.release_year = Number(release_year);
    }
    if (country_id) {
      where.country_id = Number(country_id);
    }

    // --- THÊM LOGIC LỌC MỚI CHO ACTOR ---
    if (actor_id) {
      where.movieActors = {
        some: {
          actor_id: Number(actor_id), // Lọc các phim có diễn viên này
        },
      };
    }
    // --- KẾT THÚC THÊM ---

    // 3. Thực hiện truy vấn (Không đổi)
    const [moviesData, total] = await prisma.$transaction([
      prisma.movie.findMany({
        where: where, // 'where' object đã được cập nhật
        skip: skip,
        take: limit,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          title: true,
          poster_url: true,
          status: true,
          type: true,
          tmdb_id: true,
          view_count: true,
          created_at: true,
          total_episodes: true,
          _count: {
            select: { episodes: true },
          },
        },
      }),
      prisma.movie.count({ where: where }),
    ]);

    // (Phần còn lại của hàm giữ nguyên)
    const movies = moviesData.map((movie) => ({
      ...movie,
      view_count: movie.view_count.toString(),
      episode_count_display:
        movie.type === "series"
          ? `${movie._count.episodes} / ${movie.total_episodes || "?"}`
          : `${movie._count.episodes}`,
    }));

    // 4. Trả về response
    return sendSuccess(res, 200, "Lấy danh sách phim thành công", {
      pagination: {
        page: page,
        perPage: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
      movies: movies,
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, "Lỗi máy chủ khi lấy danh sách phim.");
  }
};

exports.handleImportFromTmdb = async (req, res) => {
  // Lấy tmdbId và type từ body của request
  const { tmdbId, type } = req.body; // type: 'movie' hoặc 'tv'

  if (!tmdbId || !type) {
    return sendError(res, 400, "Cần có 'tmdbId' và 'type' (movie/tv).");
  }

  try {
    let importedData;
    if (type === "movie") {
      importedData = await importMovieFromTmdb(Number(tmdbId));
    } else if (type === "tv") {
      importedData = await importTvShowFromTmdb(Number(tmdbId));
    } else {
      return sendError(res, 400, "Loại (type) không hợp lệ.");
    }

    const dataToSend = {
      ...importedData,
      view_count: importedData.view_count.toString(), // Chuyển đổi ở đây
    };

    return sendSuccess(res, 201, `Nhập [${type}] thành công.`, dataToSend);
  } catch (error) {
    console.error(error);
    return sendError(res, 500, error.message || "Lỗi máy chủ khi nhập phim.");
  }
};

exports.handleTmdbSearch = async (req, res) => {
  const { query } = req.query; // Lấy từ khóa tìm kiếm

  if (!query) {
    return sendError(res, 400, "Cần có 'query' để tìm kiếm.");
  }

  try {
    // Gọi API '/search/multi' của TMDb
    // /multi sẽ tìm cả phim lẻ (movie) và phim bộ (tv)
    const response = await axios.get(`${TMDB_BASE_URL}/search/multi`, {
      params: {
        api_key: TMDB_API_KEY,
        query: query,
        language: "vi-VN",
        page: 1,
      },
    });

    // Lọc và làm sạch kết quả trước khi gửi về client
    const filteredResults = response.data.results
      .filter((item) => item.media_type === "movie" || item.media_type === "tv")
      .map((item) => {
        if (item.media_type === "movie") {
          return {
            id: item.id,
            type: "movie",
            title: item.title,
            imdb_score: item.vote_average,
            total_episodes: item.number_of_episodes,
            year: item.release_date ? item.release_date.split("-")[0] : "N/A",
            poster: item.poster_path
              ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
              : null,
          };
        } else {
          // media_type === 'tv'
          return {
            id: item.id,
            type: "tv",
            title: item.name,
            imdb_score: item.vote_average,
            total_episodes: item.number_of_episodes,
            year: item.first_air_date
              ? item.first_air_date.split("-")[0]
              : "N/A",
            poster: item.poster_path
              ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
              : null,
          };
        }
      });

    return sendSuccess(res, 200, "Tìm kiếm thành công", filteredResults);
  } catch (error) {
    console.error("Lỗi khi proxy tìm kiếm TMDb:", error);
    return sendError(res, 500, "Lỗi khi tìm kiếm trên TMDb.");
  }
};

exports.getMovieDetailsForAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Lấy phim TỪ CSDL (bao gồm các source đã lưu)
    const movie = await prisma.movie.findUniqueOrThrow({
      where: { id: Number(id) },
      include: {
        country: true,
        movieGenres: { include: { genre: true } },
        movieActors: { include: { actor: true } },
        movieDirectors: { include: { director: true } },
        episodes: {
          // Lấy các tập ĐÃ CÓ TRONG DB
          include: { videoSources: true },
          orderBy: [{ season_number: "asc" }, { episode_number: "asc" }],
        },
      },
    });

    let finalEpisodeList = [];

    // 2. Tạo một Map (bản đồ) các tập đã lưu (để tra cứu nhanh)
    // Key: tmdb_id, Value: đối tượng 'episode' (bao gồm videoSources)
    const localEpisodeMap = new Map();
    for (const localEp of movie.episodes) {
      if (localEp.tmdb_id) {
        localEpisodeMap.set(localEp.tmdb_id, localEp);
      }
    }

    // 3. Lấy danh sách tập MASTER TỪ TMDB
    // (Chỉ áp dụng cho phim bộ có tmdb_id)
    if (movie.type === "tv" && movie.tmdb_id) {
      const tvRes = await axios.get(
        `${TMDB_BASE_URL}/tv/${movie.tmdb_id}?api_key=${TMDB_API_KEY}&language=vi-VN`
      );
      const tvData = tvRes.data;

      let tmdbEpisodes = [];
      for (const season of tvData.seasons) {
        if (season.season_number === 0) continue; // Bỏ qua Specials
        const seasonRes = await axios.get(
          `${TMDB_BASE_URL}/tv/${movie.tmdb_id}/season/${season.season_number}?api_key=${TMDB_API_KEY}&language=vi-VN`
        );

        seasonRes.data.episodes.forEach((ep) => {
          tmdbEpisodes.push({
            tmdb_id: ep.id,
            title: `S${ep.season_number} E${ep.episode_number}: ${ep.name}`,
            episode_number: ep.episode_number,
            season_number: ep.season_number,
            duration: ep.runtime || tvData.episode_run_time[0] || 0,
          });
        });
      }

      // 4. TRỘN (MERGE) hai danh sách
      finalEpisodeList = tmdbEpisodes.map((tmdbEp) => {
        const localEp = localEpisodeMap.get(tmdbEp.tmdb_id);

        if (localEp) {
          // TÌM THẤY: Dùng metadata của TMDb + sources của CSDL
          return {
            id: localEp.id, // ID CSDL
            tmdb_id: tmdbEp.tmdb_id,
            title: tmdbEp.title,
            episode_number: tmdbEp.episode_number,
            season_number: tmdbEp.season_number,
            duration: tmdbEp.duration,
            videoSources: localEp.videoSources.map((vs) => ({
              id: vs.id,
              video_url: vs.video_url,
              quality: vs.quality,
              label: vs.label,
            })),
          };
        } else {
          // KHÔNG TÌM THẤY: (Tập mới trên TMDb)
          return {
            id: null, // Chưa có ID CSDL
            tmdb_id: tmdbEp.tmdb_id,
            title: tmdbEp.title,
            episode_number: tmdbEp.episode_number,
            season_number: tmdbEp.season_number,
            duration: tmdbEp.duration,
            videoSources: [], // Rỗng
          };
        }
      });
    } else {
      // (Nếu là phim lẻ hoặc không có tmdb_id)
      // Chỉ hiển thị các tập/source đã lưu trong CSDL
      finalEpisodeList = movie.episodes.map((ep) => ({
        id: ep.id,
        tmdb_id: ep.tmdb_id,
        title: ep.title,
        episode_number: ep.episode_number,
        season_number: ep.season_number,
        duration: ep.duration,
        videoSources: ep.videoSources.map((vs) => ({
          id: vs.id,
          video_url: vs.video_url,
          quality: vs.quality,
          label: vs.label,
        })),
      }));
    }

    // 5. Trả về cấu trúc Form
    const formData = {
      id: movie.id,
      tmdb_id: movie.tmdb_id,
      title: movie.title,
      description: movie.description,
      imdb_score: movie.imdb_score, // Sửa lại từ 'vote_average'
      type: movie.type,
      status: movie.status,
      release_year: movie.release_year,
      duration: movie.duration,
      poster_url: movie.poster_url,
      banner_url: movie.banner_url,
      country: movie.country
        ? { iso_id: movie.country.iso_id, name: movie.country.name }
        : null,
      genres: movie.movieGenres.map((mg) => mg.genre),
      actors: movie.movieActors.map((ma) => ma.actor),
      directors: movie.movieDirectors.map((md) => md.director),
      episodes: finalEpisodeList, // <-- Trả về danh sách đã trộn
    };

    return sendSuccess(res, 200, "Lấy chi tiết phim thành công", formData);
  } catch (err) {
    console.error(err);
    return sendError(res, 404, "Không tìm thấy phim.");
  }
};

// ------------------------------------
// API 2: CẬP NHẬT PHIM (STATUS & SOURCES)
// ------------------------------------
exports.updateMovie = async (req, res) => {
  const { id } = req.params; // ID của Movie
  const body = req.body; // Đây là 'form' state từ frontend

  try {
    const updatedMovie = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái 'status' của phim
      // Cập nhật luôn tổng số tập dựa trên danh sách master từ TMDb
      const movie = await tx.movie.update({
        where: { id: Number(id) },
        data: {
          status: body.status,
          total_episodes: body.episodes.length, // Cập nhật tổng số tập
        },
      });

      // 2. Lặp qua TẤT CẢ các tập (danh sách master)
      for (const ep of body.episodes) {
        // Lọc các source hợp lệ
        const validSources = ep.videoSources.filter(
          (s) => s.video_url && s.video_url.trim() !== ""
        );

        if (ep.id) {
          // --- LOGIC CŨ: TẬP ĐÃ TỒN TẠI (ep.id is not null) ---

          // Xóa TẤT CẢ video source cũ của tập này
          await tx.videoSource.deleteMany({
            where: { episode_id: ep.id }, // Dùng ID tập (CSDL)
          });

          // Cập nhật metadata (tên, thời lượng) và thêm lại source (nếu có)
          await tx.episode.update({
            where: { id: ep.id },
            data: {
              title: ep.title, // Cập nhật metadata từ TMDb
              duration: ep.duration,
              // Tạo lại các source mới
              videoSources:
                validSources.length > 0
                  ? {
                      create: validSources.map((source) => ({
                        video_url: source.video_url,
                        quality: source.quality,
                        label: source.label,
                      })),
                    }
                  : undefined, // Nếu không có source hợp lệ, không tạo
            },
          });
        } else {
          // --- LOGIC MỚI: TẬP CHƯA TỒN TẠI (ep.id is null) ---

          // Chỉ tạo tập MỚI nếu nó có ít nhất 1 source
          if (validSources.length > 0) {
            await tx.episode.create({
              data: {
                movie_id: movie.id, // Liên kết với phim
                tmdb_id: ep.tmdb_id,
                title: ep.title,
                season_number: ep.season_number,
                episode_number: ep.episode_number,
                duration: ep.duration,
                // Tạo các video source
                videoSources: {
                  create: validSources.map((source) => ({
                    video_url: source.video_url,
                    quality: source.quality,
                    label: source.label,
                  })),
                },
              },
            });
          }
          // (Nếu tập mới không có source nào thì bỏ qua, không tạo)
        }
      }
      return movie;
    });

    // (Giữ nguyên logic trả về của bạn)
    const result = {
      ...updatedMovie,
      view_count: updatedMovie.view_count.toString(),
    };
    return sendSuccess(res, 200, "Cập nhật phim thành công!", result);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi khi cập nhật phim.");
  }
};

exports.getHeroSliderMovies = async (req, res) => {
  try {
    const { accountId } = req.query;
    const accountIdNumber = accountId ? Number(accountId) : null;
    const movies = await prisma.movie.findMany({
      where: {
        status: "published",
      },
      take: 6,
      orderBy: {
        created_at: "desc",
      },
      select: {
        id: true,
        title: true,
        description: true,
        duration: true,
        banner_url: true,
        imdb_score: true,
        type: true, // <-- THÊM: Cần biết loại phim
        total_episodes: true, // <-- THÊM: Cần biết tổng số tập
        movieGenres: {
          select: { genre: { select: { name: true } } },
        },
        likes: accountIdNumber
          ? {
              where: {
                account_id: accountIdNumber,
              },
              select: {
                account_id: true,
              },
              take: 1,
            }
          : undefined,
        _count: {
          select: { likes: true },
        },
      },
    });

    // 2. Định dạng lại dữ liệu
    const formattedMovies = movies.map((movie) => {
      let title = movie.title;
      let subtitle = null;
      if (movie.title.includes(":")) {
        const parts = movie.title.split(":");
        title = parts[0].trim();
        subtitle = parts.slice(1).join(":").trim();
      }

      // --- LOGIC MỚI CHO THỜI LƯỢNG / SỐ TẬP ---
      const durationDisplay =
        movie.type === "tv"
          ? `${movie.total_episodes || 0} tập` // Nếu là phim bộ
          : formatDuration(movie.duration); // Nếu là phim lẻ

      return {
        id: movie.id,
        title: title,
        subtitle: subtitle,
        description: movie.description,
        imdb: movie.imdb_score,
        likes: movie._count.likes,

        duration: durationDisplay, // <-- SỬA Ở ĐÂY
        isLiked: accountIdNumber ? movie.likes.length > 0 : false,
        genres: movie.movieGenres.map((mg) => mg.genre.name),
        bgImageUrl: movie.banner_url,
      };
    });

    return sendSuccess(res, 200, "Lấy slider thành công", formattedMovies);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi máy chủ khi lấy slider.");
  }
};

exports.getHomeCategories = async (req, res) => {
  try {
    // 1. Tìm 50 phim mới nhất (đã published) và thể loại của chúng
    const { accountId } = req.query;
    const accountIdNumber = accountId ? Number(accountId) : null;
    const recentMovies = await prisma.movie.findMany({
      where: { status: "published" },
      orderBy: { created_at: "desc" },
      take: 50, // Lấy 50 phim mới nhất
      include: {
        movieGenres: {
          include: {
            genre: true, // Lấy thông tin thể loại
          },
        },
      },
    });

    // 2. Lọc ra 3 thể loại duy nhất (unique) đầu tiên
    const topGenres = [];
    const genreIds = new Set();

    for (const movie of recentMovies) {
      for (const mg of movie.movieGenres) {
        if (!genreIds.has(mg.genre.id)) {
          genreIds.add(mg.genre.id);
          topGenres.push({
            id: mg.genre.id,
            name: mg.genre.name,
          });
        }
        if (topGenres.length >= 3) break; // Dừng khi đủ 3 thể loại
      }
      if (topGenres.length >= 3) break;
    }

    // 3. Lấy 6 phim cho mỗi thể loại (chạy song song)
    const categoryPromises = topGenres.map((genre) =>
      prisma.movie.findMany({
        where: {
          status: "published",
          movieGenres: {
            some: { genre_id: genre.id },
          },
        },
        take: 6, // Lấy 6 phim
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          title: true,
          poster_url: true,
          likes: accountIdNumber
            ? {
                where: {
                  account_id: accountIdNumber,
                },
                select: {
                  account_id: true,
                },
                take: 1,
              }
            : undefined,
        },
      })
    );

    // Chờ tất cả truy vấn hoàn thành
    const movieResults = await Promise.all(categoryPromises);

    // 4. Định dạng lại kết quả
    const finalCategories = topGenres.map((genre, index) => ({
      category: genre.name, // "Comedy Movies"
      movies: movieResults[index].map((movie) => ({
        id: movie.id,
        title: movie.title,
        posterUrl: movie.poster_url, // Đổi tên
        isLiked: accountIdNumber ? movie.likes.length > 0 : false,
      })),
    }));

    return sendSuccess(
      res,
      200,
      "Lấy danh mục trang chủ thành công",
      finalCategories
    );
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi máy chủ khi lấy danh mục.");
  }
};

exports.getTopActors = async (req, res) => {
  try {
    // 1. Lấy 12 diễn viên có nhiều phim nhất
    // (Lấy 12 để dự phòng trường hợp 1-2 người không có ảnh)
    const actors = await prisma.actor.findMany({
      orderBy: {
        movies: {
          _count: "desc", // Sắp xếp theo số lượng phim
        },
      },
      take: 12,
      select: {
        id: true,
        name: true,
        avatar_url: true, // Lấy URL từ CSDL
        _count: {
          select: { movies: true },
        },
      },
    });

    // 2. Lọc & Định dạng
    const formattedActors = actors
      // Đảm bảo họ có ít nhất 1 phim VÀ có ảnh đại diện
      .filter((actor) => actor._count.movies > 0 && actor.avatar_url)
      // Lấy 10 người đầu tiên
      .slice(0, 10)
      .map((actor) => ({
        id: actor.id,
        name: actor.name,
        imageUrl: actor.avatar_url, // Đổi tên trường
      }));

    return sendSuccess(
      res,
      200,
      "Lấy danh sách diễn viên thành công",
      formattedActors
    );
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi máy chủ khi lấy diễn viên.");
  }
};

exports.getAllGenres = async (req, res) => {
  try {
    const genres = await prisma.genre.findMany({
      orderBy: {
        name: "asc", // Sắp xếp theo ABC
      },
      select: {
        id: true,
        name: true,
      },
    });

    return sendSuccess(res, 200, "Lấy danh sách thể loại thành công", genres);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi máy chủ khi lấy thể loại.");
  }
};

// ------------------------------------
// API LẤY TẤT CẢ QUỐC GIA (PUBLIC/ADMIN)
// ------------------------------------
exports.getAllCountries = async (req, res) => {
  try {
    const countries = await prisma.country.findMany({
      orderBy: {
        name: "asc", // Sắp xếp theo ABC
      },
      select: {
        id: true,
        name: true,
      },
    });

    return sendSuccess(
      res,
      200,
      "Lấy danh sách quốc gia thành công",
      countries
    );
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi máy chủ khi lấy quốc gia.");
  }
};

exports.getPublicMovies = async (req, res) => {
  try {
    // 1. Lấy tham số
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // Hiển thị 20 phim mỗi trang
    const skip = (page - 1) * limit;
    const accountId = req.query.accountId ? Number(req.query.accountId) : null;
    const { type, search, release_year, country_id, genre_id } = req.query;

    // 2. Xây dựng 'where'
    const where = {
      status: "published", // --- LUÔN LỌC PHIM ĐÃ CÔNG KHAI ---
    };

    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }
    if (type) {
      where.type = type;
    }
    if (release_year) {
      where.release_year = Number(release_year);
    }
    if (country_id) {
      where.country_id = Number(country_id);
    }
    if (genre_id) {
      where.movieGenres = { some: { genre_id: Number(genre_id) } };
    }
    // (Bạn có thể thêm lọc diễn viên ở đây nếu muốn)

    // 3. Thực hiện truy vấn
    const [moviesData, total] = await prisma.$transaction([
      prisma.movie.findMany({
        where: where,
        skip: skip,
        take: limit,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          title: true,
          poster_url: true,
          type: true,
          imdb_score: true,
          likes: accountId
            ? {
                where: {
                  account_id: accountId, // Lấy tất cả Likes của user này trên phim này
                },
                select: {
                  account_id: true, // Chỉ cần 1 trường để kiểm tra tồn tại
                },
                take: 1, // Chỉ cần kiểm tra 1 record
              }
            : undefined,
        },
      }),
      prisma.movie.count({ where: where }),
    ]);

    // 4. Định dạng lại dữ liệu cho card (tùy chọn)
    const movies = moviesData.map((movie) => ({
      id: movie.id,
      title: movie.title,
      posterUrl: movie.poster_url, // Đổi tên
      // Thêm các trường khác nếu Card cần
      isLiked: accountId ? movie.likes.length > 0 : false,
    }));

    // 5. Trả về response
    return sendSuccess(res, 200, "Lấy danh sách phim thành công", {
      pagination: {
        page: page,
        perPage: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
      movies: movies,
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, "Lỗi máy chủ khi lấy danh sách phim.");
  }
};

exports.getPublicMovieDetails = async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Lấy phim VÀ đảm bảo nó đã "published"
    const movie = await prisma.movie.findUniqueOrThrow({
      where: {
        id: Number(id),
        status: "published", // Chỉ lấy phim đã công khai
      },
      include: {
        country: true,
        movieGenres: { include: { genre: true } },
        movieActors: { include: { actor: true }, take: 10 }, // Lấy 10 diễn viên
        movieDirectors: { include: { director: true } },
        // Lấy các tập (chỉ metadata, không lấy source)
        episodes: {
          select: {
            id: true,
            title: true,
            episode_number: true,
            season_number: true,
            duration: true,
          },
          orderBy: [{ season_number: "asc" }, { episode_number: "asc" }],
        },
        // Lấy 5 bình luận mới nhất
        comments: {
          include: {
            account: { select: { full_name: true, avatar_url: true } },
          },
          orderBy: { created_at: "desc" },
          take: 5,
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
    });

    // 2. Nhóm các tập (episodes) theo mùa (season)
    const seasons = movie.episodes.reduce((acc, ep) => {
      const season = ep.season_number || 1;
      if (!acc[season]) {
        acc[season] = []; // Tạo mảng mới nếu chưa có mùa này
      }
      acc[season].push(ep);
      return acc;
    }, {}); // Kết quả: { 1: [ep1, ep2], 2: [ep3, ep4] }

    // 3. Định dạng dữ liệu trả về
    const formattedData = {
      id: movie.id,
      title: movie.title,
      poster_url: movie.poster_url,
      banner_url: movie.banner_url,
      description: movie.description,
      imdb_score: movie.imdb_score,
      type: movie.type,
      duration: formatDuration(movie.duration),
      release_year: movie.release_year,
      // (Schema của bạn không có 'rating' (T18), 'subtitle' (Decalcomania))
      // (Chúng ta sẽ bỏ qua chúng)
      genres: movie.movieGenres.map((mg) => mg.genre.name),
      actors: movie.movieActors.map((ma) => ma.actor),
      directors: movie.movieDirectors.map((md) => md.director),
      seasons: seasons, // Dữ liệu tập phim đã nhóm
      comments: movie.comments,
      likesCount: movie._count.likes,
      commentsCount: movie._count.comments,
    };

    return sendSuccess(res, 200, "Lấy chi tiết phim thành công", formattedData);
  } catch (err) {
    console.error(err);
    return sendError(res, 404, "Không tìm thấy phim hoặc phim chưa công khai.");
  }
};

exports.getSimilarMovies = async (req, res) => {
  const { movieId } = req.params; // Lấy ID phim từ URL
  const accountId = req.query.accountId ? Number(req.query.accountId) : null;
  try {
    // 1. Gọi Python KNN API (đang chạy trên cổng 5001)
    const recsResponse = await axios.get(`http://localhost:5001/recommend`, {
      params: { movie_id: Number(movieId) },
    });

    const movieIds = recsResponse.data.movie_ids; // [101, 55, 204]

    if (!movieIds || movieIds.length === 0) {
      return sendSuccess(res, 200, "Không tìm thấy đề xuất", []);
    }

    // 2. "Hydrate" (Làm đầy) các ID bằng data từ CSDL
    const movies = await prisma.movie.findMany({
      where: {
        id: { in: movieIds },
        status: "published",
      },
      select: {
        id: true,
        title: true,
        poster_url: true,
        type: true,
        likes: accountId
          ? {
              where: {
                account_id: accountId,
              },
              select: {
                account_id: true,
              },
              take: 1,
            }
          : undefined,
      },
    });

    // 3. Sắp xếp lại theo thứ tự KNN trả về
    const sortedMovies = movieIds
      .map((id) => movies.find((m) => m.id === id))
      .filter(Boolean); // Lọc ra các phim 'published'

    // 4. Định dạng lại
    const formattedMovies = sortedMovies.map((movie) => ({
      id: movie.id,
      title: movie.title,
      posterUrl: movie.poster_url,
      isLiked: accountId ? movie.likes.length > 0 : false,
    }));

    return sendSuccess(res, 200, "Lấy đề xuất thành công", formattedMovies);
  } catch (err) {
    console.error(err);
    // (Fallback nếu service Python lỗi)
    return sendError(res, 500, "Lỗi service đề xuất.");
  }
};

exports.toggleLike = async (req, res) => {
  // Giả sử middleware xác thực đã gắn user object vào req.user
  const accountId = req.user?.id;
  const { movieId } = req.params;

  if (!accountId) {
    return sendError(res, 401, "Bạn cần đăng nhập để thực hiện hành động này.");
  }

  try {
    const movieIdNumber = Number(movieId);

    // 1. Kiểm tra trạng thái hiện tại (Đã Like chưa?)
    const existingLike = await prisma.likeMovie.findUnique({
      where: {
        account_id_movie_id: {
          // <-- Dùng ID ghép (composite ID)
          account_id: accountId,
          movie_id: movieIdNumber,
        },
      },
    });

    let action = "";

    if (existingLike) {
      // 2. Nếu đã tồn tại -> XÓA (UNLIKE)
      await prisma.likeMovie.delete({
        where: {
          account_id_movie_id: {
            account_id: accountId,
            movie_id: movieIdNumber,
          },
        },
      });
      action = "unliked";
    } else {
      // 3. Nếu chưa tồn tại -> TẠO MỚI (LIKE)
      await prisma.likeMovie.create({
        data: {
          account_id: accountId,
          movie_id: movieIdNumber,
        },
      });
      action = "liked";
    }

    // 4. Trả về thông báo thành công
    return sendSuccess(res, 200, `Phim đã được ${action} thành công.`, {
      action,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi máy chủ khi cập nhật trạng thái Like.");
  }
};
