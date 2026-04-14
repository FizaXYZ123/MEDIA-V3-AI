'use strict';

module.exports = {
  beforeCreate: async (event) => {
    const d = event.params.data || {};
    if (d.label) d.labelLower = String(d.label).trim().toLowerCase();
  },
  beforeUpdate: async (event) => {
    const d = event.params.data || {};
    if (d.label) d.labelLower = String(d.label).trim().toLowerCase();
  },
};
