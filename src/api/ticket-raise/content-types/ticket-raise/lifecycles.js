'use strict';

/**
 * Auto-calculate slaDeadline based on priority on creation.
 * urgent → 4h, high → 24h, medium → 48h, low → 72h.
 */

const SLA_HOURS = {
  urgent: 4,
  high: 24,
  medium: 48,
  low: 72,
};

function computeDeadline(priority) {
  const hours = SLA_HOURS[priority] ?? SLA_HOURS.medium;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

module.exports = {
  beforeCreate(event) {
    const data = event.params.data || {};
    if (!data.slaDeadline) {
      data.slaDeadline = computeDeadline(data.priority);
    }
  },

  beforeUpdate(event) {
    const data = event.params.data || {};
    // If priority is being changed and slaDeadline wasn't explicitly set, recompute.
    if (data.priority && !data.slaDeadline) {
      data.slaDeadline = computeDeadline(data.priority);
    }
    // Auto-stamp closedAt when transitioning to closed/resolved.
    if (
      (data.status === 'closed' || data.status === 'resolved') &&
      !data.closedAt
    ) {
      data.closedAt = new Date();
    }
  },
};
