'use strict';

module.exports = {

  beforeCreate(event) {
    const { data } = event.params;

    // ✅ Generate fullName from firstName + lastName
    if (data.firstName || data.lastName) {
      data.fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    }

    // ✅ Trim fullName
    if (typeof data.fullName === 'string') {
      data.fullName = data.fullName.trim();
    }

    // ✅ Normalize phoneNumber (digits only)
    if (data.phoneNumber) {
      data.phoneNumber = String(data.phoneNumber).replace(/\D/g, '');
    }
  },

  beforeUpdate(event) {
    const { data } = event.params;

    // ✅ Regenerate fullName whenever first/last name change
    if (data.firstName || data.lastName) {
      data.fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    }

    // ✅ Trim fullName
    if (typeof data.fullName === 'string') {
      data.fullName = data.fullName.trim();
    }

    // ✅ Normalize phoneNumber (digits only)
    if (data.phoneNumber) {
      data.phoneNumber = String(data.phoneNumber).replace(/\D/g, '');
    }
  },

};
