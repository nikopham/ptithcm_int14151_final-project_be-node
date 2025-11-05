const router = require("express").Router();
const authController = require("../controllers/auth.controller");
const registerController = require("../controllers/register.controller");
const authenticate = require("../middlewares/authenticate");
const verifyRefreshToken = require("../middlewares/verifyRefreshToken");
const resetPwController = require("../controllers/resetPw.controller");
const csrfProtection = require("../middlewares/csrfProtection");
const authorizeRoles = require("../middlewares/authorizeRoles");

router.post("/reset-pw", resetPwController.resetPwController);

router.post("/login", authController.login);

router.post("/refresh-token", verifyRefreshToken, authController.refreshToken);

router.post("/logout", authController.logout);

router.post(
  "/logout-all",

  authController.logoutAll
);

router.get("/me", authenticate, authController.me);

router.post("/register", registerController.registerController);

router.patch(
  "/status",
  authenticate,
  authorizeRoles("admin"),
  authController.updateAccountStatus
);

router.patch(
  "/change-password/:accountId",
  authenticate,

  authorizeRoles("viewer", "admin"),
  authController.changePasswordByAccountId
);

module.exports = router;
