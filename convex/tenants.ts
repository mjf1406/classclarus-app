import { makeTenantsAPI } from "@djpanda/convex-tenants";
import { components } from "./_generated/api.js";
import { getAuthUserId } from "@convex-dev/auth/server";
import { authz } from "./authz.ts";

export const {
  // Organizations
  listOrganizations,
  getOrganization,
  getOrganizationBySlug,
  createOrganization,
  updateOrganization,
  transferOwnership,
  deleteOrganization,
  // Members
  listMembers,
  countMembers,
  getMember,
  getCurrentMember,
  addMember,
  bulkAddMembers,
  removeMember,
  bulkRemoveMembers,
  updateMemberRole,
  suspendMember,
  unsuspendMember,
  leaveOrganization,
  // Teams
  listTeams,
  listTeamsAsTree,
  countTeams,
  getTeam,
  listTeamMembers,
  isTeamMember,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  // Invitations
  listInvitations,
  countInvitations,
  getInvitation,
  getPendingInvitations,
  inviteMember,
  bulkInviteMembers,
  acceptInvitation,
  resendInvitation,
  cancelInvitation,
  // Authorization
  checkPermission,
  getUserPermissions,
  getUserRoles,
  grantPermission,
  denyPermission,
  getAuditLog,
  // Optional (only when generateUploadUrl is set): generateLogoUploadUrl,
} = makeTenantsAPI(components.tenants, {
  authz, // Required: your Authz instance from authz.ts
  creatorRole: "owner", // Role assigned when creating an org (must match authz.ts)

  auth: async (ctx) => {
    return (await getAuthUserId(ctx)) ?? null;
  },

  getUser: async (ctx, userId) => {
    const user = await ctx.db.get(userId);
    return user ? { name: user.name, email: user.email } : null;
  },

  //   onInvitationCreated: async (ctx, invitation) => {
  //     // Send invitation email
  //     await ctx.scheduler.runAfter(0, internal.emails.sendInvitation, {
  //       email: invitation.inviteeIdentifier,
  //       organizationName: invitation.organizationName,
  //     });
  //   },
});
