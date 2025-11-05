const xss = require("xss");

module.exports = (req, res, next) => {
  if (req.query && typeof req.query === "object") {
    for (const key in req.query) {
      if (Object.prototype.hasOwnProperty.call(req.query, key)) {
        req.query[key] = xss(req.query[key]);
      }
    }
  }
  next();
};
