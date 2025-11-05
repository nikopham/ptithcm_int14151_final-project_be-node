const express = require("express");
const router = express.Router();
const movieController = require("../controllers/movie.controller");
const authenticate = require("../middlewares/authenticate");
const authorizeRoles = require("../middlewares/authorizeRoles");
const csrfProtection = require("../middlewares/csrfProtection");

router.get(
  "/",
  authenticate,
  authorizeRoles("admin"),
  movieController.getMoviesForAdmin
);

router.get(
  "/filter",
  movieController.getPublicMovies
);

router.post(
  "/import",
  authenticate,
  authorizeRoles("admin"),
  movieController.handleImportFromTmdb
);

router.get(
  "/tmdb-search",
  authenticate,
  authorizeRoles("admin"),
  movieController.handleTmdbSearch
);

router.get(
  "/tmdb-details",
  authenticate,
  authorizeRoles("admin"),
  movieController.getTmdbDetailsForForm
);

// API MỚI 2: Tạo phim từ form (payload lớn) (Chỉ Admin)
router.post(
  "/create-from-form",
  authenticate,
  authorizeRoles("admin"),
  movieController.createMovieFromForm
);

router.get(
  "/detail/:id",
  authenticate,
  authorizeRoles("admin"),
  movieController.getMovieDetailsForAdmin
);

router.put(
  "/detail/:id",
  authenticate,
  authorizeRoles("admin"),
  movieController.updateMovie
);

router.get(
  "/new-feed",
  movieController.getHeroSliderMovies
);

router.get("/movie-categories", movieController.getHomeCategories);
router.get("/top-actors", movieController.getTopActors);
router.get("/genres", movieController.getAllGenres);

// API MỚI: Lấy tất cả quốc gia
router.get("/countries", movieController.getAllCountries);
// router.patch(
//   "/edit",
//   authenticate,

//   authorizeRoles("admin"),
//   movieController.editEmployee
// );

// router.post(
//   "/delete",
//   authenticate,
//   authorizeRoles("admin"),
//   movieController.deleteAccount
// );

router.get(
  "/movie-info/:id", // :id là ID CSDL
  movieController.getPublicMovieDetails
);
router.get(
  "/recommendations/similar/:movieId",
  movieController.getSimilarMovies
);
router.post("/like/:movieId", authenticate, movieController.toggleLike);


module.exports = router;
