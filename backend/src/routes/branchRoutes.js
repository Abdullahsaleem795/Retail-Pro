const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
const {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getTransfers,
  createTransfer,
  markInTransit,
  receiveTransfer,
  cancelTransfer,
} = require('../controllers/branchController');

const router = express.Router();
router.use(protect);

// Mounted before /:id so "transfers" is never mistaken for a branch id.
router
  .route('/transfers')
  .get(getTransfers)
  .post(requirePermission(PERMISSIONS.BRANCH_MANAGE), createTransfer);

router.put('/transfers/:id/in-transit', requirePermission(PERMISSIONS.BRANCH_MANAGE), markInTransit);
router.put('/transfers/:id/receive', requirePermission(PERMISSIONS.BRANCH_MANAGE), receiveTransfer);
router.put('/transfers/:id/cancel', requirePermission(PERMISSIONS.BRANCH_MANAGE), cancelTransfer);

router
  .route('/')
  .get(getBranches)
  .post(requirePermission(PERMISSIONS.BRANCH_MANAGE), createBranch);

router
  .route('/:id')
  .put(requirePermission(PERMISSIONS.BRANCH_MANAGE), updateBranch)
  .delete(requirePermission(PERMISSIONS.BRANCH_MANAGE), deleteBranch);

module.exports = router;
