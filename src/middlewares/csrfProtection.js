const csrf = require("csurf");

module.exports = csrf({
  cookie: {
    httpOnly: true,
    sameSite: "none",
    secure: process.env.NODE_ENV === "production",
  },
});
