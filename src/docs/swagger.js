const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Movie Web API",
      version: "1.0.0",
      description: "API document cho hệ thống web xem phim PTITHCM",
    },
    servers: [{ url: "http://localhost:5000" }],
  },
  apis: ["./src/routes/*.js"],
};

module.exports = swaggerJsdoc(options);
