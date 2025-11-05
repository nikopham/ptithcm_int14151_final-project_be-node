const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const session = require("express-session");
const { connectDB } = require("./config/db");
const rateLimit = require("./middlewares/rateLimit");
const xssSanitizer = require("./middlewares/xssSanitizer");
const errorHandler = require("./middlewares/errorHandler");
const csrfProtection = require("./middlewares/csrfProtection");
const sanitizeQuery = require("./middlewares/sanitizeQuery");
const app = express();
connectDB();

app.use(helmet());
app.set("trust proxy", 1);
const ORIGIN = process.env.FRONTEND_ORIGIN;
app.use(
  cors({
    origin: ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  })
);

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(sanitizeQuery);
// app.use(csrfProtection);
// ======= RATE LIMIT =======

app.use(rateLimit);

// ======= SESSION COOKIE =======
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: 15 * 60 * 1000,
    },
  })
);

// ======= CSRF PROTECTION =======
app.get("/api/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

const authRoutes = require("./routes/auth.route");
app.use("/api/auth", authRoutes);

const accountRoutes = require("./routes/account.route");
app.use("/api/accounts", accountRoutes);

// const provinceRoutes = require("./routes/province.route");
// app.use("/api/provinces", provinceRoutes);

// const communeRoutes = require("./routes/commune.route");
// app.use("/api/communes", communeRoutes);

// const amenityRoutes = require("./routes/amenity.route");
// app.use("/api/amenities", amenityRoutes);

// const bookingRoutes = require("./routes/booking.route");
// app.use("/api/bookings", bookingRoutes);

// const customerRoutes = require("./routes/customer.route");
// app.use("/api/customers", customerRoutes);

const movieRoutes = require("./routes/movie.route");
app.use("/api/movies", movieRoutes);

// const reviewRoutes = require("./routes/review.route");
// app.use("/api/reviews", reviewRoutes);

// const cloudinaryRoutes = require("./routes/cloudinary.route");
// app.use("/api/cloudinary", cloudinaryRoutes);

// const paymentRoutes = require("./routes/payment.route");
// app.use("/api/payments", paymentRoutes);

// const adminRoutes = require("./routes/admin.metrics.route");
// app.use("/api/admin", adminRoutes);

// ======= SWAGGER DOC =======
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ======= GLOBAL ERROR HANDLER =======
app.use(errorHandler);

module.exports = app;
