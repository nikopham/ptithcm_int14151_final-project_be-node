// /src/services/tmdb-importer.service.js
const axios = require("axios");
const { prisma } = require("../config/db");
const { MovieType } = require("@prisma/client"); // Import enum

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";

// Hàm helper
const getImageUrl = (path) => (path ? `${IMAGE_BASE_URL}${path}` : null);

/**
 * ============================================
 * 1. HÀM NHẬP PHIM LẺ (MOVIE)
 * ============================================
 */
async function importMovieFromTmdb(tmdbId) {
  // 1. Lấy thông tin chi tiết phim
  const movieResponse = await axios.get(
    `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=vi-VN`
  );
  const movieData = movieResponse.data;
 
  // 2. Lấy thông tin diễn viên, đạo diễn (credits)
  const creditsResponse = await axios.get(
    `${TMDB_BASE_URL}/movie/${tmdbId}/credits?api_key=${TMDB_API_KEY}`
  );
  const creditsData = creditsResponse.data;

  try {
    const importedMovie = await prisma.$transaction(async (tx) => {
      // Xử lý đạo diễn
      const directors = creditsData.crew
        .filter((person) => person.job === "Director")
        .map((director) => ({
          tmdb_id: director.id,
          name: director.name,
          avatar_url: getImageUrl(director.profile_path),
        }));

      // Xử lý diễn viên
      const actors = creditsData.cast.slice(0, 10).map((actor) => ({
        tmdb_id: actor.id,
        name: actor.name,
        avatar_url: getImageUrl(actor.profile_path),
      }));

      // Xử lý thể loại
      const genres = movieData.genres.map((genre) => ({
        tmdb_id: genre.id,
        name: genre.name,
      }));

      // Xử lý quốc gia
      const countries = movieData.production_countries.map((country) => ({
        iso_id: country.iso_3166_1,
        name: country.name,
      }));
      const primaryCountry = countries[0]
        ? {
            connectOrCreate: {
              where: { iso_id: countries[0].iso_id },
              create: countries[0],
            },
          }
        : undefined;

      // Tạo hoặc cập nhật phim
      const movie = await tx.movie.upsert({
        where: { tmdb_id: tmdbId },
        update: {
          title: movieData.title,
          description: movieData.overview,
          imdb_score: movieData.vote_average,
          release_year: new Date(movieData.release_date).getFullYear(),
          duration: movieData.runtime,
          poster_url: getImageUrl(movieData.poster_path),
          banner_url: getImageUrl(movieData.backdrop_path),
          status: "pending", // Luôn đặt là pending
        },
        create: {
          tmdb_id: tmdbId,
          title: movieData.title,
          description: movieData.overview,
          type: MovieType.single,
          imdb_score: movieData.vote_average,
          status: "pending",
          release_year: new Date(movieData.release_date).getFullYear(),
          duration: movieData.runtime,
          poster_url: getImageUrl(movieData.poster_path),
          banner_url: getImageUrl(movieData.backdrop_path),
          country: primaryCountry,
          movieGenres: {
            create: genres.map((genre) => ({
              genre: {
                connectOrCreate: {
                  where: { tmdb_id: genre.tmdb_id },
                  create: genre,
                },
              },
            })),
          },
          movieActors: {
            create: actors.map((actor) => ({
              actor: {
                connectOrCreate: {
                  where: { tmdb_id: actor.tmdb_id },
                  create: actor,
                },
              },
            })),
          },
          movieDirectors: {
            create: directors.map((director) => ({
              director: {
                connectOrCreate: {
                  where: { tmdb_id: director.tmdb_id },
                  create: director,
                },
              },
            })),
          },
          // Phim lẻ cũng cần 1 tập
          episodes: {
            create: [
              {
                title: "Full Movie",
                episode_number: 1,
                duration: movieData.runtime,
              },
            ],
          },
        },
      });
      return movie;
    });
    return importedMovie;
  } catch (error) {
    console.error("Lỗi khi nhập phim lẻ:", error);
    throw new Error("Không thể nhập phim lẻ từ TMDb.");
  }
}

/**
 * ============================================
 * 2. HÀM NHẬP PHIM BỘ (TV SHOW)
 * ============================================
 */
async function importTvShowFromTmdb(tmdbId) {
  // 1. Lấy thông tin chung
  const tvShowResponse = await axios.get(
    `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=vi-VN`
  );
  const tvData = tvShowResponse.data;

  // 2. Lấy Credits
  const creditsResponse = await axios.get(
    `${TMDB_BASE_URL}/tv/${tmdbId}/credits?api_key=${TMDB_API_KEY}`
  );
  const creditsData = creditsResponse.data;

  // 3. Lấy chi tiết tất cả các tập
  let allEpisodes = [];
  for (const season of tvData.seasons) {
    if (season.season_number === 0) continue; // Bỏ qua "Specials"
    try {
      const seasonResponse = await axios.get(
        `${TMDB_BASE_URL}/tv/${tmdbId}/season/${season.season_number}?api_key=${TMDB_API_KEY}&language=vi-VN`
      );
      allEpisodes = [...allEpisodes, ...seasonResponse.data.episodes];
    } catch (e) {
      console.warn(`Không thể lấy mùa ${season.season_number}`);
    }
  }

  try {
    const importedShow = await prisma.$transaction(async (tx) => {
      // Xử lý người tạo
      const directors = tvData.created_by.map((creator) => ({
        tmdb_id: creator.id,
        name: creator.name,
        avatar_url: getImageUrl(creator.profile_path),
      }));

      // Xử lý diễn viên
      const actors = creditsData.cast.slice(0, 10).map((actor) => ({
        tmdb_id: actor.id,
        name: actor.name,
        avatar_url: getImageUrl(actor.profile_path),
      }));

      // Xử lý thể loại
      const genres = tvData.genres.map((genre) => ({
        tmdb_id: genre.id,
        name: genre.name,
      }));

      // Xử lý quốc gia
      const countries = tvData.production_countries.map((country) => ({
        iso_id: country.iso_3166_1,
        name: country.name,
      }));
      const primaryCountry = countries[0]
        ? {
            connectOrCreate: {
              where: { iso_id: countries[0].iso_id },
              create: countries[0],
            },
          }
        : undefined;

      // 6. Tạo hoặc cập nhật phim
      const movie = await tx.movie.upsert({
        where: { tmdb_id: tmdbId },
        update: {
          title: tvData.name,
          description: tvData.overview,
          imdb_score: tvData.vote_average,
          release_year: new Date(tvData.first_air_date).getFullYear(),
          duration: tvData.episode_run_time[0] || null,
          poster_url: getImageUrl(tvData.poster_path),
          banner_url: getImageUrl(tvData.backdrop_path),
          type: MovieType.series,
          status: "pending",
        },
        create: {
          tmdb_id: tmdbId,
          title: tvData.name,
          description: tvData.overview,
          imdb_score: tvData.vote_average,
          type: MovieType.series,
          status: "pending",
          release_year: new Date(tvData.first_air_date).getFullYear(),
          duration: tvData.episode_run_time[0] || null,
          poster_url: getImageUrl(tvData.poster_path),
          banner_url: getImageUrl(tvData.backdrop_path),
          country: primaryCountry,
          movieGenres: {
            create: genres.map((g) => ({
              genre: {
                connectOrCreate: { where: { tmdb_id: g.tmdb_id }, create: g },
              },
            })),
          },
          movieActors: {
            create: actors.map((a) => ({
              actor: {
                connectOrCreate: { where: { tmdb_id: a.tmdb_id }, create: a },
              },
            })),
          },
          movieDirectors: {
            create: directors.map((d) => ({
              director: {
                connectOrCreate: { where: { tmdb_id: d.tmdb_id }, create: d },
              },
            })),
          },
        },
      });

      // 7. Dùng Upsert cho từng tập phim
      for (const ep of allEpisodes) {
        await tx.episode.upsert({
          where: { tmdb_id: ep.id },

        
          update: {
            title:
              `Tập ${ep.episode_number}: ${ep.name}` ||
              `Tập ${ep.episode_number}`,
            episode_number: ep.episode_number,
            duration: ep.runtime || tvData.episode_run_time[0] || 0,

            
            season_number: ep.season_number, 
          },

          create: {
            tmdb_id: ep.id,
            movie_id: movie.id,
            title:
              `Tập ${ep.episode_number}: ${ep.name}` ||
              `Tập ${ep.episode_number}`,
            episode_number: ep.episode_number,
            duration: ep.runtime || tvData.episode_run_time[0] || 0,

            
            season_number: ep.season_number, 
          },
        });
      }
      return movie;
    });

    return importedShow;
  } catch (error) {
    console.error("Lỗi khi nhập phim bộ:", error);
    throw new Error("Không thể nhập phim bộ từ TMDb.");
  }
}

// Xuất các hàm
module.exports = {
  importMovieFromTmdb,
  importTvShowFromTmdb,
};
