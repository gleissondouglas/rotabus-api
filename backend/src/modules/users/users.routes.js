const express = require("express");

const {
  createUser,
  listUsers,
  getProfile,
  updateProfile,
  deleteUser,
  deleteMe,
  changePassword,
} = require("./users.controller");

const { authMiddleware } = require("../auth/auth.middleware");
const { adminMiddleware } = require("../auth/admin.middleware");
const { validate } = require("../../shared/middlewares/validate.middleware");
const {
  createUserSchema,
  updateProfileSchema,
  changePasswordSchema,
} = require("./users.validator");

const router = express.Router();

router.post("/", validate(createUserSchema), createUser);

router.get("/me", authMiddleware, getProfile);

router.patch("/me", authMiddleware, validate(updateProfileSchema), updateProfile);

router.patch("/me/password", authMiddleware, validate(changePasswordSchema), changePassword);

// Rota para o usuário deletar a própria conta (Direito ao Esquecimento - LGPD)
router.delete("/me", authMiddleware, deleteMe);

router.get("/", authMiddleware, adminMiddleware, listUsers);

router.delete("/:id", authMiddleware, adminMiddleware, deleteUser);

module.exports = router;
