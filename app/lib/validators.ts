/**
 * Re-export of the platform Zod schemas and field-error helpers.
 * Implementations live in `@perkos/shared-client`.
 */
export {
  emailSchema,
  walletAddressSchema,
  memberSchema,
  ipv4Schema,
  sshPublicKeySchema,
  projectSchema,
  taskSchema,
  organizationSchema,
  accessRequestSchema,
  validateApiKey,
  fieldErrors,
} from "@perkos/shared-client";
