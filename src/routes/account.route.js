const router = require("express").Router();
const authenticate = require("../middlewares/authenticate");
const verifyRefreshToken = require("../middlewares/verifyRefreshToken");
const resetPwController = require("../controllers/resetPw.controller");
const csrfProtection = require("../middlewares/csrfProtection");
const authorizeRoles = require("../middlewares/authorizeRoles");
const accountController = require("../controllers/account.controller");

router.get(
  "/info/:accountId",
  authenticate,
  authorizeRoles("viewer", "admin"),
  accountController.getAccountByAccountId
);

router.post(
  "/update/:accountId",
  authenticate,
  authorizeRoles("viewer", "admin"),
  accountController.updateAccountByAccountId
);

router.post(
  "/change-password/:accountId",
  authenticate,
  authorizeRoles("viewer", "admin"),
  accountController.changePasswordByAccountId
);

module.exports = router;
