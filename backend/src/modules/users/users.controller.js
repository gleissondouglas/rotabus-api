const {
  createUserService,
  listUsersService,
  getProfileService,
  deleteUserService,
  deleteOwnUserService,
  changePasswordService,
  updateProfileService,
} = require("./users.service");

const {
  validateCreateUserInput,
  validateChangePasswordInput,
  validateUpdateProfileInput,
} = require("./users.validator");

async function createUser(req, res, next) {
  try {
    const validatedData = validateCreateUserInput(req.body);

    const result = await createUserService(validatedData);

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
    const validatedData = validateUpdateProfileInput(req.body);

    const result = await updateProfileService({
      userId: req.user.id,
      name: validatedData.name,
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
    const validatedData = validateChangePasswordInput(req.body);

    const result = await changePasswordService({
      userId: req.user.id,
      currentPassword: validatedData.currentPassword,
      newPassword: validatedData.newPassword,
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
