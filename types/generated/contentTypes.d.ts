import type { Schema, Attribute } from '@strapi/strapi';

export interface AdminPermission extends Schema.CollectionType {
  collectionName: 'admin_permissions';
  info: {
    name: 'Permission';
    description: '';
    singularName: 'permission';
    pluralName: 'permissions';
    displayName: 'Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Attribute.JSON & Attribute.DefaultTo<{}>;
    subject: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    properties: Attribute.JSON & Attribute.DefaultTo<{}>;
    conditions: Attribute.JSON & Attribute.DefaultTo<[]>;
    role: Attribute.Relation<'admin::permission', 'manyToOne', 'admin::role'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminUser extends Schema.CollectionType {
  collectionName: 'admin_users';
  info: {
    name: 'User';
    description: '';
    singularName: 'user';
    pluralName: 'users';
    displayName: 'User';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    firstname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    username: Attribute.String;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.Private &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    resetPasswordToken: Attribute.String & Attribute.Private;
    registrationToken: Attribute.String & Attribute.Private;
    isActive: Attribute.Boolean &
      Attribute.Private &
      Attribute.DefaultTo<false>;
    roles: Attribute.Relation<'admin::user', 'manyToMany', 'admin::role'> &
      Attribute.Private;
    blocked: Attribute.Boolean & Attribute.Private & Attribute.DefaultTo<false>;
    preferedLanguage: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface AdminRole extends Schema.CollectionType {
  collectionName: 'admin_roles';
  info: {
    name: 'Role';
    description: '';
    singularName: 'role';
    pluralName: 'roles';
    displayName: 'Role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    code: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String;
    users: Attribute.Relation<'admin::role', 'manyToMany', 'admin::user'>;
    permissions: Attribute.Relation<
      'admin::role',
      'oneToMany',
      'admin::permission'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface AdminApiToken extends Schema.CollectionType {
  collectionName: 'strapi_api_tokens';
  info: {
    name: 'Api Token';
    singularName: 'api-token';
    pluralName: 'api-tokens';
    displayName: 'Api Token';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    type: Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Attribute.Required &
      Attribute.DefaultTo<'read-only'>;
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastUsedAt: Attribute.DateTime;
    permissions: Attribute.Relation<
      'admin::api-token',
      'oneToMany',
      'admin::api-token-permission'
    >;
    expiresAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_api_token_permissions';
  info: {
    name: 'API Token Permission';
    description: '';
    singularName: 'api-token-permission';
    pluralName: 'api-token-permissions';
    displayName: 'API Token Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    token: Attribute.Relation<
      'admin::api-token-permission',
      'manyToOne',
      'admin::api-token'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminTransferToken extends Schema.CollectionType {
  collectionName: 'strapi_transfer_tokens';
  info: {
    name: 'Transfer Token';
    singularName: 'transfer-token';
    pluralName: 'transfer-tokens';
    displayName: 'Transfer Token';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastUsedAt: Attribute.DateTime;
    permissions: Attribute.Relation<
      'admin::transfer-token',
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    expiresAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminTransferTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    name: 'Transfer Token Permission';
    description: '';
    singularName: 'transfer-token-permission';
    pluralName: 'transfer-token-permissions';
    displayName: 'Transfer Token Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    token: Attribute.Relation<
      'admin::transfer-token-permission',
      'manyToOne',
      'admin::transfer-token'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUploadFile extends Schema.CollectionType {
  collectionName: 'files';
  info: {
    singularName: 'file';
    pluralName: 'files';
    displayName: 'File';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    alternativeText: Attribute.String;
    caption: Attribute.String;
    width: Attribute.Integer;
    height: Attribute.Integer;
    formats: Attribute.JSON;
    hash: Attribute.String & Attribute.Required;
    ext: Attribute.String;
    mime: Attribute.String & Attribute.Required;
    size: Attribute.Decimal & Attribute.Required;
    url: Attribute.String & Attribute.Required;
    previewUrl: Attribute.String;
    provider: Attribute.String & Attribute.Required;
    provider_metadata: Attribute.JSON;
    related: Attribute.Relation<'plugin::upload.file', 'morphToMany'>;
    folder: Attribute.Relation<
      'plugin::upload.file',
      'manyToOne',
      'plugin::upload.folder'
    > &
      Attribute.Private;
    folderPath: Attribute.String &
      Attribute.Required &
      Attribute.Private &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUploadFolder extends Schema.CollectionType {
  collectionName: 'upload_folders';
  info: {
    singularName: 'folder';
    pluralName: 'folders';
    displayName: 'Folder';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    pathId: Attribute.Integer & Attribute.Required & Attribute.Unique;
    parent: Attribute.Relation<
      'plugin::upload.folder',
      'manyToOne',
      'plugin::upload.folder'
    >;
    children: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.folder'
    >;
    files: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.file'
    >;
    path: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginContentReleasesRelease extends Schema.CollectionType {
  collectionName: 'strapi_releases';
  info: {
    singularName: 'release';
    pluralName: 'releases';
    displayName: 'Release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    releasedAt: Attribute.DateTime;
    scheduledAt: Attribute.DateTime;
    timezone: Attribute.String;
    status: Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Attribute.Required;
    actions: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Schema.CollectionType {
  collectionName: 'strapi_release_actions';
  info: {
    singularName: 'release-action';
    pluralName: 'release-actions';
    displayName: 'Release Action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    type: Attribute.Enumeration<['publish', 'unpublish']> & Attribute.Required;
    entry: Attribute.Relation<
      'plugin::content-releases.release-action',
      'morphToOne'
    >;
    contentType: Attribute.String & Attribute.Required;
    locale: Attribute.String;
    release: Attribute.Relation<
      'plugin::content-releases.release-action',
      'manyToOne',
      'plugin::content-releases.release'
    >;
    isEntryValid: Attribute.Boolean;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginI18NLocale extends Schema.CollectionType {
  collectionName: 'i18n_locale';
  info: {
    singularName: 'locale';
    pluralName: 'locales';
    collectionName: 'locales';
    displayName: 'Locale';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.SetMinMax<
        {
          min: 1;
          max: 50;
        },
        number
      >;
    code: Attribute.String & Attribute.Unique;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::i18n.locale',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::i18n.locale',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Schema.CollectionType {
  collectionName: 'up_permissions';
  info: {
    name: 'permission';
    description: '';
    singularName: 'permission';
    pluralName: 'permissions';
    displayName: 'Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String & Attribute.Required;
    role: Attribute.Relation<
      'plugin::users-permissions.permission',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole extends Schema.CollectionType {
  collectionName: 'up_roles';
  info: {
    name: 'role';
    description: '';
    singularName: 'role';
    pluralName: 'roles';
    displayName: 'Role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    description: Attribute.String;
    type: Attribute.String & Attribute.Unique;
    permissions: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    users: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsUser extends Schema.CollectionType {
  collectionName: 'up_users';
  info: {
    name: 'user';
    description: '';
    singularName: 'user';
    pluralName: 'users';
    displayName: 'User';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    username: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    provider: Attribute.String;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    resetPasswordToken: Attribute.String & Attribute.Private;
    confirmationToken: Attribute.String & Attribute.Private;
    confirmed: Attribute.Boolean & Attribute.DefaultTo<false>;
    blocked: Attribute.Boolean & Attribute.DefaultTo<false>;
    role: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    firstName: Attribute.String;
    lastName: Attribute.String;
    phoneNumber: Attribute.String;
    distribute_drafts: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::publish-distribute.publish-distribute'
    >;
    artist_details: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::artist-detail.artist-detail'
    >;
    Profile_image: Attribute.Media;
    currency: Attribute.String;
    dob: Attribute.Date;
    notifications: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::notification.notification'
    >;
    user_type: Attribute.Enumeration<['basic', 'subscribed', 'enterprise']>;
    label_fee_histories: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::label-fee-history.label-fee-history'
    >;
    admin_fee_histories: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::admin-fee-history.admin-fee-history'
    >;
    invoices: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::invoice.invoice'
    >;
    published_track_update_logs: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::published-track-update-log.published-track-update-log'
    >;
    platformFeeOverride: Attribute.Decimal;
    commissionOverride: Attribute.Decimal;
    availableBalance: Attribute.Decimal & Attribute.DefaultTo<0>;
    pendingBalance: Attribute.Decimal & Attribute.DefaultTo<0>;
    paymentMethod: Attribute.JSON;
    payout_requests: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::payout-request.payout-request'
    >;
    user_subscriptions: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::user-subscription.user-subscription'
    >;
    payment_logs: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::payment-log.payment-log'
    >;
    enterprise_commissions: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::enterprise-commission.enterprise-commission'
    >;
    csv_report_logs: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::csv-report-log.csv-report-log'
    >;
    billing_cards: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::billing-card.billing-card'
    >;
    user_payout_details: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::user-payout-detail.user-payout-detail'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiAdminFeeHistoryAdminFeeHistory
  extends Schema.CollectionType {
  collectionName: 'admin_fee_histories';
  info: {
    singularName: 'admin-fee-history';
    pluralName: 'admin-fee-histories';
    displayName: 'admin-fee-history';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    feePercentage: Attribute.Integer;
    effective_from: Attribute.DateTime;
    users_permissions_user: Attribute.Relation<
      'api::admin-fee-history.admin-fee-history',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::admin-fee-history.admin-fee-history',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::admin-fee-history.admin-fee-history',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiArtistDetailArtistDetail extends Schema.CollectionType {
  collectionName: 'artist_details';
  info: {
    singularName: 'artist-detail';
    pluralName: 'artist-details';
    displayName: 'artist_details';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    artistName: Attribute.String & Attribute.Required;
    roleName: Attribute.String;
    appleMusicId: Attribute.String;
    spotifyId: Attribute.String;
    youtubeUsername: Attribute.String;
    soundcloudPage: Attribute.String;
    facebookPage: Attribute.String;
    twitterUsername: Attribute.String;
    websiteUrl: Attribute.String;
    biography: Attribute.Text;
    owner: Attribute.Relation<
      'api::artist-detail.artist-detail',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    tracks: Attribute.Relation<
      'api::artist-detail.artist-detail',
      'manyToMany',
      'api::distribute-track.distribute-track'
    >;
    Profile_image: Attribute.Media;
    itsVerified: Attribute.Boolean & Attribute.DefaultTo<false>;
    requiredVerification: Attribute.Boolean & Attribute.DefaultTo<false>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::artist-detail.artist-detail',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::artist-detail.artist-detail',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiAuditLogAuditLog extends Schema.CollectionType {
  collectionName: 'audit_logs';
  info: {
    singularName: 'audit-log';
    pluralName: 'audit-logs';
    displayName: 'Audit Log';
    description: 'Append-only log of mutating admin actions for compliance review';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    actor: Attribute.Relation<
      'api::audit-log.audit-log',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    actorEmail: Attribute.String;
    impersonatedUserId: Attribute.Integer;
    action: Attribute.String & Attribute.Required;
    method: Attribute.String;
    path: Attribute.String;
    targetType: Attribute.String;
    targetId: Attribute.String;
    statusCode: Attribute.Integer;
    ipAddress: Attribute.String;
    userAgent: Attribute.String;
    metadata: Attribute.JSON;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::audit-log.audit-log',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::audit-log.audit-log',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiBillingCardBillingCard extends Schema.CollectionType {
  collectionName: 'billing_cards';
  info: {
    singularName: 'billing-card';
    pluralName: 'billing-cards';
    displayName: 'BillingCard';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    card_holder_name: Attribute.String & Attribute.Required;
    card_number: Attribute.String & Attribute.Required;
    cvv: Attribute.String & Attribute.Required;
    expiry_month: Attribute.Integer & Attribute.Required;
    expiry_year: Attribute.Integer & Attribute.Required;
    autopay_enabled: Attribute.Boolean & Attribute.DefaultTo<false>;
    UserDetail: Attribute.Relation<
      'api::billing-card.billing-card',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::billing-card.billing-card',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::billing-card.billing-card',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiBlogBlog extends Schema.CollectionType {
  collectionName: 'blogs';
  info: {
    singularName: 'blog';
    pluralName: 'blogs';
    displayName: 'Blogs';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String;
    date: Attribute.DateTime;
    cover_image: Attribute.Media;
    slug: Attribute.String;
    meta_title: Attribute.String;
    meta_description: Attribute.Text;
    content: Attribute.Text;
    category: Attribute.JSON;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::blog.blog', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::blog.blog', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiCsvReportLogCsvReportLog extends Schema.CollectionType {
  collectionName: 'csv_report_logs';
  info: {
    singularName: 'csv-report-log';
    pluralName: 'csv-report-logs';
    displayName: 'csv-report-log';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    startMonth: Attribute.String;
    endMonth: Attribute.String;
    csvData: Attribute.Text;
    reportName: Attribute.String;
    users_permissions_user: Attribute.Relation<
      'api::csv-report-log.csv-report-log',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::csv-report-log.csv-report-log',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::csv-report-log.csv-report-log',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiDistributeDraftDistributeDraft
  extends Schema.CollectionType {
  collectionName: 'distribute_drafts';
  info: {
    singularName: 'distribute-draft';
    pluralName: 'distribute-drafts';
    displayName: 'distributeDraft';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    ReleaseType: Attribute.Enumeration<['Single', 'EP', 'Album']> &
      Attribute.Required;
    ReleaseTitle: Attribute.String & Attribute.Required;
    Version: Attribute.Enumeration<['Remaster', 'Live', 'Remix', 'Other']>;
    LanguageOfTheTitles: Attribute.String;
    PrimaryGenre: Attribute.String;
    SecondaryGenre: Attribute.String;
    AddLabel: Attribute.String;
    CoverArt: Attribute.Media;
    Priority: Attribute.Enumeration<['Standard', 'Priority']> &
      Attribute.DefaultTo<'Standard'>;
    TimeZoneOfReference: Attribute.String;
    OriginalReleaseDate: Attribute.Date;
    Countries: Attribute.JSON;
    MusicStores: Attribute.JSON;
    CopyrightYear: Attribute.Integer;
    PhonogramRightsHolderName: Attribute.String;
    PhonogramRightsHolderYear: Attribute.Integer;
    PriceCategory: Attribute.Enumeration<['Budget', 'Mid', 'Full', 'Premium']>;
    TrackList: Attribute.Relation<
      'api::distribute-draft.distribute-draft',
      'oneToMany',
      'api::distribute-track.distribute-track'
    >;
    DigitalReleaseDate: Attribute.Date;
    ReleaseTime: Attribute.Time;
    CopyrightholderName: Attribute.String;
    UserDetail: Attribute.Relation<
      'api::distribute-draft.distribute-draft',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    CompletedSteps: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::distribute-draft.distribute-draft',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::distribute-draft.distribute-draft',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiDistributeTrackDistributeTrack
  extends Schema.CollectionType {
  collectionName: 'distribute_tracks';
  info: {
    singularName: 'distribute-track';
    pluralName: 'distribute-tracks';
    displayName: 'distributeTrack';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    DraftRelease: Attribute.Relation<
      'api::distribute-track.distribute-track',
      'manyToOne',
      'api::distribute-draft.distribute-draft'
    >;
    PublishedRelease: Attribute.Relation<
      'api::distribute-track.distribute-track',
      'manyToOne',
      'api::publish-distribute.publish-distribute'
    >;
    TrackName: Attribute.String & Attribute.Required;
    TrackUpload: Attribute.Media & Attribute.Required;
    PrimaryGenre: Attribute.String;
    SecondaryGenre: Attribute.String;
    RoleCredits: Attribute.JSON;
    LyricsAvailable: Attribute.Boolean & Attribute.DefaultTo<false>;
    AppropriateForAllAudiences: Attribute.Boolean & Attribute.DefaultTo<true>;
    ContainsExplicitContent: Attribute.Boolean & Attribute.DefaultTo<false>;
    CleanVersionAvailable: Attribute.Boolean & Attribute.DefaultTo<false>;
    ISRC: Attribute.String;
    ISWC: Attribute.String;
    RequestANewISRC: Attribute.Boolean & Attribute.DefaultTo<false>;
    Status: Attribute.Enumeration<
      ['In-Progress', 'Completed', 'Pending', 'In-Review', 'Cancelled']
    >;
    artistDetails: Attribute.Relation<
      'api::distribute-track.distribute-track',
      'manyToMany',
      'api::artist-detail.artist-detail'
    >;
    royalty_reports: Attribute.Relation<
      'api::distribute-track.distribute-track',
      'oneToMany',
      'api::royalty-report.royalty-report'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::distribute-track.distribute-track',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::distribute-track.distribute-track',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiEnterpriseCommissionEnterpriseCommission
  extends Schema.CollectionType {
  collectionName: 'enterprise_commissions';
  info: {
    singularName: 'enterprise-commission';
    pluralName: 'enterprise-commissions';
    displayName: 'enterprise-commission';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    commission_percentage: Attribute.Integer;
    effective_from: Attribute.DateTime;
    users_permissions_user: Attribute.Relation<
      'api::enterprise-commission.enterprise-commission',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::enterprise-commission.enterprise-commission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::enterprise-commission.enterprise-commission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiFaqFaq extends Schema.CollectionType {
  collectionName: 'faqs';
  info: {
    singularName: 'faq';
    pluralName: 'faqs';
    displayName: 'Faq';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    question: Attribute.String;
    answer: Attribute.Text;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::faq.faq', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::faq.faq', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiForgetPasswordForgetPassword extends Schema.CollectionType {
  collectionName: 'forget_passwords';
  info: {
    singularName: 'forget-password';
    pluralName: 'forget-passwords';
    displayName: 'forget-password';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    otp: Attribute.String;
    otpExpiry: Attribute.DateTime;
    otpVerified: Attribute.Boolean & Attribute.DefaultTo<false>;
    email: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::forget-password.forget-password',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::forget-password.forget-password',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiFormSubmissionFormSubmission extends Schema.CollectionType {
  collectionName: 'form_submissions';
  info: {
    singularName: 'form-submission';
    pluralName: 'form-submissions';
    displayName: 'FormSubmission';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    name: Attribute.String;
    phone: Attribute.String;
    email: Attribute.Email;
    message: Attribute.Text;
    formTitle: Attribute.String;
    services: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::form-submission.form-submission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::form-submission.form-submission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiGlobalSettingGlobalSetting extends Schema.SingleType {
  collectionName: 'global_settings';
  info: {
    singularName: 'global-setting';
    pluralName: 'global-settings';
    displayName: 'Global Setting';
    description: 'Platform-wide defaults for fees, payouts, and pricing';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    defaultSonosuiteCut: Attribute.Decimal & Attribute.DefaultTo<15>;
    defaultPlatformFee: Attribute.Decimal & Attribute.DefaultTo<5>;
    minimumPayoutThreshold: Attribute.Decimal & Attribute.DefaultTo<50>;
    fastReleaseFeePerTrack: Attribute.Decimal & Attribute.DefaultTo<13>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::global-setting.global-setting',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::global-setting.global-setting',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiImportedReportImportedReport extends Schema.CollectionType {
  collectionName: 'imported_reports';
  info: {
    singularName: 'imported-report';
    pluralName: 'imported-reports';
    displayName: 'imported-report';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    FileName: Attribute.String;
    startDate: Attribute.Date;
    endDate: Attribute.Date;
    totalNet: Attribute.Float;
    skippedNet: Attribute.Float;
    CommissionPercent: Attribute.Float;
    OriginalTotal: Attribute.Float;
    PlatformCommission: Attribute.JSON;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::imported-report.imported-report',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::imported-report.imported-report',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiInvoiceInvoice extends Schema.CollectionType {
  collectionName: 'invoices';
  info: {
    singularName: 'invoice';
    pluralName: 'invoices';
    displayName: 'invoices';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    month: Attribute.Integer & Attribute.Required;
    year: Attribute.Integer & Attribute.Required;
    totalEarnings: Attribute.Decimal & Attribute.Required;
    labelFeePercentage: Attribute.Integer & Attribute.DefaultTo<0>;
    labelFeeAmount: Attribute.Decimal & Attribute.DefaultTo<0>;
    amountPayableBeforeAdminFee: Attribute.Decimal & Attribute.DefaultTo<0>;
    adminFeePercentage: Attribute.Integer & Attribute.DefaultTo<0>;
    adminFeeAmount: Attribute.Decimal & Attribute.DefaultTo<0>;
    enterpriseCommissionPercentage: Attribute.Decimal & Attribute.DefaultTo<0>;
    enterpriseCommissionAmount: Attribute.Decimal & Attribute.DefaultTo<0>;
    finalAmountPayable: Attribute.Decimal & Attribute.Required;
    invoiceDate: Attribute.DateTime;
    users_permissions_user: Attribute.Relation<
      'api::invoice.invoice',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::invoice.invoice',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::invoice.invoice',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiLabelFeeHistoryLabelFeeHistory
  extends Schema.CollectionType {
  collectionName: 'label_fee_histories';
  info: {
    singularName: 'label-fee-history';
    pluralName: 'label-fee-histories';
    displayName: 'label-fee-history';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    feePercentage: Attribute.Integer;
    effective_from: Attribute.DateTime;
    users_permissions_user: Attribute.Relation<
      'api::label-fee-history.label-fee-history',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::label-fee-history.label-fee-history',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::label-fee-history.label-fee-history',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiNotificationNotification extends Schema.CollectionType {
  collectionName: 'notifications';
  info: {
    singularName: 'notification';
    pluralName: 'notifications';
    displayName: 'Notifications';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String;
    message: Attribute.String;
    users_permissions_user: Attribute.Relation<
      'api::notification.notification',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    is_read: Attribute.Boolean & Attribute.DefaultTo<false>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::notification.notification',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::notification.notification',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiPaymentLogPaymentLog extends Schema.CollectionType {
  collectionName: 'payment_logs';
  info: {
    singularName: 'payment-log';
    pluralName: 'payment-logs';
    displayName: 'payment-log';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    users_permissions_user: Attribute.Relation<
      'api::payment-log.payment-log',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    plan: Attribute.Relation<
      'api::payment-log.payment-log',
      'manyToOne',
      'api::plan.plan'
    >;
    stripeSessionId: Attribute.String & Attribute.Unique;
    paymentIntentId: Attribute.String & Attribute.Unique;
    amount: Attribute.Decimal;
    currency: Attribute.String;
    status: Attribute.Enumeration<
      ['success', 'failed', 'processing', 'locked']
    >;
    processing: Attribute.Boolean & Attribute.DefaultTo<false>;
    paidAt: Attribute.DateTime;
    draftId: Attribute.Integer;
    publish_distribute: Attribute.Relation<
      'api::payment-log.payment-log',
      'manyToOne',
      'api::publish-distribute.publish-distribute'
    >;
    type: Attribute.Enumeration<
      ['subscription', 'priority-upload', 'upgrade', 'artist-addon']
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::payment-log.payment-log',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::payment-log.payment-log',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiPayoutRequestPayoutRequest extends Schema.CollectionType {
  collectionName: 'payout_requests';
  info: {
    singularName: 'payout-request';
    pluralName: 'payout-requests';
    displayName: 'Payout Request';
    description: 'Artist withdrawal requests against available balance';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    user: Attribute.Relation<
      'api::payout-request.payout-request',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    amount: Attribute.Decimal & Attribute.Required;
    currency: Attribute.String & Attribute.DefaultTo<'USD'>;
    status: Attribute.Enumeration<
      ['pending', 'approved', 'processing', 'completed', 'rejected']
    > &
      Attribute.DefaultTo<'pending'>;
    reviewedBy: Attribute.Relation<
      'api::payout-request.payout-request',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    reviewedAt: Attribute.DateTime;
    completedAt: Attribute.DateTime;
    rejectionReason: Attribute.Text;
    paymentMethodSnapshot: Attribute.JSON;
    transactionReference: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::payout-request.payout-request',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::payout-request.payout-request',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiPhoneCounterPhoneCounter extends Schema.CollectionType {
  collectionName: 'phone_counters';
  info: {
    singularName: 'phone-counter';
    pluralName: 'phone-counters';
    displayName: 'phoneCounter';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    date: Attribute.DateTime;
    count: Attribute.Integer;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::phone-counter.phone-counter',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::phone-counter.phone-counter',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiPlanPlan extends Schema.CollectionType {
  collectionName: 'plans';
  info: {
    singularName: 'plan';
    pluralName: 'plans';
    displayName: 'Plan';
    description: 'Subscription plans available to artists';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    name: Attribute.String & Attribute.Required & Attribute.Unique;
    price_inr: Attribute.Decimal;
    price_cad: Attribute.Decimal;
    price_usd: Attribute.Decimal;
    billingCycle: Attribute.Enumeration<['yearly']> &
      Attribute.DefaultTo<'yearly'>;
    defaultCommission: Attribute.Decimal & Attribute.DefaultTo<0>;
    isActive: Attribute.Boolean & Attribute.DefaultTo<true>;
    default_label_fee: Attribute.Integer;
    default_admin_fee: Attribute.Integer;
    maxPrimaryArtists: Attribute.String;
    priority_order: Attribute.Integer;
    user_subscriptions: Attribute.Relation<
      'api::plan.plan',
      'oneToMany',
      'api::user-subscription.user-subscription'
    >;
    payment_logs: Attribute.Relation<
      'api::plan.plan',
      'oneToMany',
      'api::payment-log.payment-log'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::plan.plan', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::plan.plan', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiPublishDistributePublishDistribute
  extends Schema.CollectionType {
  collectionName: 'publish_distributes';
  info: {
    singularName: 'publish-distribute';
    pluralName: 'publish-distributes';
    displayName: 'PublishDistribute';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    ReleaseType: Attribute.Enumeration<['Single', 'EP', 'Album']> &
      Attribute.Required;
    ReleaseTitle: Attribute.String & Attribute.Required;
    Version: Attribute.Enumeration<['Remaster', 'Live', 'Remix', 'Other']>;
    LanguageOfTheTitles: Attribute.String;
    PrimaryGenre: Attribute.String;
    SecondaryGenre: Attribute.String;
    AddLabel: Attribute.String;
    CoverArt: Attribute.Media;
    Priority: Attribute.Enumeration<['Standard', 'Priority']> &
      Attribute.DefaultTo<'Standard'>;
    TimeZoneOfReference: Attribute.String;
    OriginalReleaseDate: Attribute.Date;
    Countries: Attribute.JSON;
    MusicStores: Attribute.JSON;
    CopyrightYear: Attribute.Integer;
    PhonogramRightsHolderName: Attribute.String;
    PhonogramRightsHolderYear: Attribute.Integer;
    PriceCategory: Attribute.Enumeration<['Budget', 'Mid', 'Full', 'Premium']>;
    TrackList: Attribute.Relation<
      'api::publish-distribute.publish-distribute',
      'oneToMany',
      'api::distribute-track.distribute-track'
    >;
    DigitalReleaseDate: Attribute.Date;
    ReleaseTime: Attribute.Time;
    CopyrightholderName: Attribute.String;
    UserDetail: Attribute.Relation<
      'api::publish-distribute.publish-distribute',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    Status: Attribute.Enumeration<['In-Progress', 'Completed', 'Cancelled']> &
      Attribute.DefaultTo<'In-Progress'>;
    published_track_update_logs: Attribute.Relation<
      'api::publish-distribute.publish-distribute',
      'oneToMany',
      'api::published-track-update-log.published-track-update-log'
    >;
    payment_logs: Attribute.Relation<
      'api::publish-distribute.publish-distribute',
      'oneToMany',
      'api::payment-log.payment-log'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::publish-distribute.publish-distribute',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::publish-distribute.publish-distribute',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiPublishedTrackUpdateLogPublishedTrackUpdateLog
  extends Schema.CollectionType {
  collectionName: 'published_track_update_logs';
  info: {
    singularName: 'published-track-update-log';
    pluralName: 'published-track-update-logs';
    displayName: 'published-track-update-logs';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    changes: Attribute.JSON;
    publish_distribute: Attribute.Relation<
      'api::published-track-update-log.published-track-update-log',
      'manyToOne',
      'api::publish-distribute.publish-distribute'
    >;
    users_permissions_user: Attribute.Relation<
      'api::published-track-update-log.published-track-update-log',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::published-track-update-log.published-track-update-log',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::published-track-update-log.published-track-update-log',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiRoyaltyReportRoyaltyReport extends Schema.CollectionType {
  collectionName: 'royalty_reports';
  info: {
    singularName: 'royalty-report';
    pluralName: 'royalty-reports';
    displayName: 'RoyaltyReport';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    ISRC: Attribute.String;
    TrackTitle: Attribute.String;
    Artist: Attribute.String;
    ReleaseTitle: Attribute.String;
    Platform: Attribute.String;
    Country: Attribute.String;
    Units: Attribute.Integer;
    UnitPrice: Attribute.Float;
    GrossTotal: Attribute.Float;
    NetTotal: Attribute.Float;
    StartDate: Attribute.Date;
    EndDate: Attribute.Date;
    ConfirmationReportDate: Attribute.Date;
    Currency: Attribute.String;
    Label: Attribute.String;
    Type: Attribute.String;
    Taxes: Attribute.Float;
    ChannelCosts: Attribute.Float;
    CurrencyRate: Attribute.Float;
    GrossTotalClientCurrency: Attribute.Float;
    NetTotalClientCurrency: Attribute.Float;
    OtherCostsClientCurrency: Attribute.Float;
    ChannelCostsClientCurrency: Attribute.Float;
    UserEmail: Attribute.String;
    UPC: Attribute.String;
    TenantId: Attribute.String;
    OriginalNetTotal: Attribute.Float;
    distribute_track: Attribute.Relation<
      'api::royalty-report.royalty-report',
      'manyToOne',
      'api::distribute-track.distribute-track'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::royalty-report.royalty-report',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::royalty-report.royalty-report',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSubscribeEmailSubscribeEmail extends Schema.CollectionType {
  collectionName: 'subscribe_emails';
  info: {
    singularName: 'subscribe-email';
    pluralName: 'subscribe-emails';
    displayName: 'SubscribeEmail';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    SubscribeEmail: Attribute.Email;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::subscribe-email.subscribe-email',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::subscribe-email.subscribe-email',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiTicketMessageTicketMessage extends Schema.CollectionType {
  collectionName: 'ticket_messages';
  info: {
    singularName: 'ticket-message';
    pluralName: 'ticket-messages';
    displayName: 'Ticket Message';
    description: 'Conversation entry attached to a support ticket';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    ticket: Attribute.Relation<
      'api::ticket-message.ticket-message',
      'manyToOne',
      'api::ticket-raise.ticket-raise'
    >;
    sender: Attribute.Relation<
      'api::ticket-message.ticket-message',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    message: Attribute.Text & Attribute.Required;
    attachments: Attribute.Media;
    isInternal: Attribute.Boolean & Attribute.DefaultTo<false>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::ticket-message.ticket-message',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::ticket-message.ticket-message',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiTicketRaiseTicketRaise extends Schema.CollectionType {
  collectionName: 'ticket_raises';
  info: {
    singularName: 'ticket-raise';
    pluralName: 'ticket-raises';
    displayName: 'Ticket Raise';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
    description: Attribute.Text;
    attachment: Attribute.Media;
    status: Attribute.Enumeration<
      ['open', 'in-progress', 'waiting_on_customer', 'resolved', 'closed']
    > &
      Attribute.DefaultTo<'open'>;
    is_read: Attribute.Boolean & Attribute.DefaultTo<false>;
    user: Attribute.Relation<
      'api::ticket-raise.ticket-raise',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    category: Attribute.Enumeration<
      ['billing', 'release_issue', 'payout', 'general', 'account']
    > &
      Attribute.DefaultTo<'general'>;
    priority: Attribute.Enumeration<['low', 'medium', 'high', 'urgent']> &
      Attribute.DefaultTo<'medium'>;
    assignedTo: Attribute.Relation<
      'api::ticket-raise.ticket-raise',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    slaDeadline: Attribute.DateTime;
    closedAt: Attribute.DateTime;
    messages: Attribute.Relation<
      'api::ticket-raise.ticket-raise',
      'oneToMany',
      'api::ticket-message.ticket-message'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::ticket-raise.ticket-raise',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::ticket-raise.ticket-raise',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiUserLabelUserLabel extends Schema.CollectionType {
  collectionName: 'user_labels';
  info: {
    singularName: 'user-label';
    pluralName: 'user-labels';
    displayName: 'User Label';
    description: 'Per-user private labels for releases/tracks';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    label: Attribute.String & Attribute.Required;
    labelLower: Attribute.String;
    owner: Attribute.Relation<
      'api::user-label.user-label',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::user-label.user-label',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::user-label.user-label',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiUserPayoutDetailUserPayoutDetail
  extends Schema.CollectionType {
  collectionName: 'user_payout_details';
  info: {
    singularName: 'user-payout-detail';
    pluralName: 'user-payout-details';
    displayName: 'UserPayoutDetails';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    country: Attribute.Enumeration<['India', 'Canada', 'United States']> &
      Attribute.Required;
    currency: Attribute.Enumeration<['INR', 'CAD', 'USD']> & Attribute.Required;
    account_holder_name: Attribute.String & Attribute.Required;
    bank_name: Attribute.String & Attribute.Required;
    account_number: Attribute.String & Attribute.Required;
    ifsc_code: Attribute.String;
    transit_number: Attribute.String;
    institution_number: Attribute.String;
    routing_number: Attribute.String;
    userDetail: Attribute.Relation<
      'api::user-payout-detail.user-payout-detail',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::user-payout-detail.user-payout-detail',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::user-payout-detail.user-payout-detail',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiUserSubscriptionUserSubscription
  extends Schema.CollectionType {
  collectionName: 'user_subscriptions';
  info: {
    singularName: 'user-subscription';
    pluralName: 'user-subscriptions';
    displayName: 'user-subscription';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    users_permissions_user: Attribute.Relation<
      'api::user-subscription.user-subscription',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    startDate: Attribute.DateTime;
    endDate: Attribute.DateTime;
    status: Attribute.Enumeration<['active', 'expired', 'canceled']>;
    subscriptionType: Attribute.Enumeration<['subscription', 'upgrade']>;
    upgradedAt: Attribute.DateTime;
    plan: Attribute.Relation<
      'api::user-subscription.user-subscription',
      'manyToOne',
      'api::plan.plan'
    >;
    artistsAllowed: Attribute.String & Attribute.DefaultTo<'1'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::user-subscription.user-subscription',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::user-subscription.user-subscription',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface ContentTypes {
      'admin::permission': AdminPermission;
      'admin::user': AdminUser;
      'admin::role': AdminRole;
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
      'api::admin-fee-history.admin-fee-history': ApiAdminFeeHistoryAdminFeeHistory;
      'api::artist-detail.artist-detail': ApiArtistDetailArtistDetail;
      'api::audit-log.audit-log': ApiAuditLogAuditLog;
      'api::billing-card.billing-card': ApiBillingCardBillingCard;
      'api::blog.blog': ApiBlogBlog;
      'api::csv-report-log.csv-report-log': ApiCsvReportLogCsvReportLog;
      'api::distribute-draft.distribute-draft': ApiDistributeDraftDistributeDraft;
      'api::distribute-track.distribute-track': ApiDistributeTrackDistributeTrack;
      'api::enterprise-commission.enterprise-commission': ApiEnterpriseCommissionEnterpriseCommission;
      'api::faq.faq': ApiFaqFaq;
      'api::forget-password.forget-password': ApiForgetPasswordForgetPassword;
      'api::form-submission.form-submission': ApiFormSubmissionFormSubmission;
      'api::global-setting.global-setting': ApiGlobalSettingGlobalSetting;
      'api::imported-report.imported-report': ApiImportedReportImportedReport;
      'api::invoice.invoice': ApiInvoiceInvoice;
      'api::label-fee-history.label-fee-history': ApiLabelFeeHistoryLabelFeeHistory;
      'api::notification.notification': ApiNotificationNotification;
      'api::payment-log.payment-log': ApiPaymentLogPaymentLog;
      'api::payout-request.payout-request': ApiPayoutRequestPayoutRequest;
      'api::phone-counter.phone-counter': ApiPhoneCounterPhoneCounter;
      'api::plan.plan': ApiPlanPlan;
      'api::publish-distribute.publish-distribute': ApiPublishDistributePublishDistribute;
      'api::published-track-update-log.published-track-update-log': ApiPublishedTrackUpdateLogPublishedTrackUpdateLog;
      'api::royalty-report.royalty-report': ApiRoyaltyReportRoyaltyReport;
      'api::subscribe-email.subscribe-email': ApiSubscribeEmailSubscribeEmail;
      'api::ticket-message.ticket-message': ApiTicketMessageTicketMessage;
      'api::ticket-raise.ticket-raise': ApiTicketRaiseTicketRaise;
      'api::user-label.user-label': ApiUserLabelUserLabel;
      'api::user-payout-detail.user-payout-detail': ApiUserPayoutDetailUserPayoutDetail;
      'api::user-subscription.user-subscription': ApiUserSubscriptionUserSubscription;
    }
  }
}
