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

const router = express.Router();

router.post("/", createUser);

router.get("/me", authMiddleware, getProfile);

router.patch("/me", authMiddleware, updateProfile);

router.patch("/me/password", authMiddleware, changePassword);

// Rota para o usuário deletar a própria conta (Direito ao Esquecimento - LGPD)
router.delete("/me", authMiddleware, deleteMe);

router.get("/", authMiddleware, adminMiddleware, listUsers);

router.delete("/:id", authMiddleware, adminMiddleware, deleteUser);

module.exports = router;
