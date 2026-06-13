const {
  createUserService,
  listUsersService,
  getProfileService,
  deleteUserService,
  deleteOwnUserService,
  changePasswordService,
  updateProfileService,
} = require("./users.service");

async function createUser(req, res, next) {
  try {
    const result = await createUserService(req.body);

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const result = await listUsersService();

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function getProfile(req, res, next) {
  try {
    const result = await getProfileService(req.user.id);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const result = await updateProfileService({
      userId: req.user.id,
      name: req.body.name,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const result = await deleteUserService({
      userIdToDelete: req.params.id,
      authenticatedUserId: req.user.id,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function deleteMe(req, res, next) {
  try {
    const result = await deleteOwnUserService(req.user.id);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const result = await changePasswordService({
      userId: req.user.id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createUser,
  listUsers,
  getProfile,
  updateProfile,
  deleteUser,
  deleteMe,
  changePassword,
};
