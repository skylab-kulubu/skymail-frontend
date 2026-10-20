/**
 * Every template SkyMail seeds, in one list.
 *
 * An explicit registry rather than a glob: the folder also holds shared pieces
 * (theme, action-mail) that are not templates, and an accidental export should
 * not become a live e-mail. The order here is the order they are seeded and the
 * order the catalogue reads in.
 */
import type { ComponentType } from "react";
import type { TemplateMeta } from "./types";

import FreeBasic, { meta as freeBasic } from "./free-basic";

import KeycloakVerifyEmail, { meta as keycloakVerifyEmail } from "./keycloak-verify-email";
import KeycloakResetPassword, { meta as keycloakResetPassword } from "./keycloak-reset-password";
import KeycloakUpdateEmail, { meta as keycloakUpdateEmail } from "./keycloak-update-email";
import KeycloakIdpLink, { meta as keycloakIdpLink } from "./keycloak-idp-link";
import KeycloakPersonalEmailConfirm, { meta as keycloakPersonalEmailConfirm } from "./keycloak-personal-email-confirm";
import KeycloakLoginCode, { meta as keycloakLoginCode } from "./keycloak-login-code";
import KeycloakLoginCodeAlarm, { meta as keycloakLoginCodeAlarm } from "./keycloak-login-code-alarm";
import KeycloakGeneric, { meta as keycloakGeneric } from "./keycloak-generic";

import CoreWelcome, { meta as coreWelcome } from "./core-welcome";
import CoreCertificate, { meta as coreCertificate } from "./core-certificate";
import CoreEventCancelled, { meta as coreEventCancelled } from "./core-event-cancelled";
import CoreEventReinstated, { meta as coreEventReinstated } from "./core-event-reinstated";

import AccountSecurityAlert, { meta as accountSecurityAlert } from "./account-security-alert";
import AccountPrimaryEmailChanged, { meta as accountPrimaryEmailChanged } from "./account-primary-email-changed";
import AccountDeletionRequested, { meta as accountDeletionRequested } from "./account-deletion-requested";
import AccountDeletionCompleted, { meta as accountDeletionCompleted } from "./account-deletion-completed";

import EventTicketCreated, { meta as eventTicketCreated } from "./event-ticket-created";
import EventReminder, { meta as eventReminder } from "./event-reminder";
import EventUpdated, { meta as eventUpdated } from "./event-updated";

import MailApprovalRequested, { meta as mailApprovalRequested } from "./mail-approval-requested";
import MailApprovalResolved, { meta as mailApprovalResolved } from "./mail-approval-resolved";
import OpsSendFailed, { meta as opsSendFailed } from "./ops-send-failed";
import ClubTeamMembership, { meta as clubTeamMembership } from "./club-team-membership";
import ClubRoleMembership, { meta as clubRoleMembership } from "./club-role-membership";
import ClubGroupMembership, { meta as clubGroupMembership } from "./club-group-membership";
import ClubPrivilegeChange, { meta as clubPrivilegeChange } from "./club-privilege-change";

export interface EmailTemplate {
  meta: TemplateMeta;
  Component: ComponentType;
}

export const templates: EmailTemplate[] = [
  { meta: freeBasic, Component: FreeBasic },

  { meta: keycloakVerifyEmail, Component: KeycloakVerifyEmail },
  { meta: keycloakResetPassword, Component: KeycloakResetPassword },
  { meta: keycloakUpdateEmail, Component: KeycloakUpdateEmail },
  { meta: keycloakIdpLink, Component: KeycloakIdpLink },
  { meta: keycloakPersonalEmailConfirm, Component: KeycloakPersonalEmailConfirm },
  { meta: keycloakLoginCode, Component: KeycloakLoginCode },
  { meta: keycloakLoginCodeAlarm, Component: KeycloakLoginCodeAlarm },
  { meta: keycloakGeneric, Component: KeycloakGeneric },

  { meta: coreWelcome, Component: CoreWelcome },
  { meta: coreCertificate, Component: CoreCertificate },
  { meta: coreEventCancelled, Component: CoreEventCancelled },
  { meta: coreEventReinstated, Component: CoreEventReinstated },

  { meta: accountSecurityAlert, Component: AccountSecurityAlert },
  { meta: accountPrimaryEmailChanged, Component: AccountPrimaryEmailChanged },
  { meta: accountDeletionRequested, Component: AccountDeletionRequested },
  { meta: accountDeletionCompleted, Component: AccountDeletionCompleted },

  { meta: eventTicketCreated, Component: EventTicketCreated },
  { meta: eventReminder, Component: EventReminder },
  { meta: eventUpdated, Component: EventUpdated },

  { meta: mailApprovalRequested, Component: MailApprovalRequested },
  { meta: mailApprovalResolved, Component: MailApprovalResolved },
  { meta: opsSendFailed, Component: OpsSendFailed },
  { meta: clubTeamMembership, Component: ClubTeamMembership },
  { meta: clubRoleMembership, Component: ClubRoleMembership },
  { meta: clubGroupMembership, Component: ClubGroupMembership },
  { meta: clubPrivilegeChange, Component: ClubPrivilegeChange },
];

export function findTemplate(key: string): EmailTemplate | undefined {
  return templates.find((template) => template.meta.key === key);
}
