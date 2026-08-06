import { SearchIcon, UsersIcon, XIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { MemberRow } from "@/components/members/MemberRow";
import { RemoveMemberCredenza } from "@/components/members/RemoveMemberCredenza";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useClassMembersByRole } from "@/hooks/members/useClassMembersByRole";
import { useMemberSearch } from "@/hooks/members/useMemberSearch";
import { useRemoveClassMember } from "@/hooks/members/useRemoveClassMember";
import { useSetGuardianStudentLinks } from "@/hooks/members/useSetGuardianStudentLinks";
import { useSetMemberRole } from "@/hooks/members/useSetMemberRole";
import { useCurrentUser } from "@/hooks/user/useCurrentUser";
import type {
  ClassMemberPublic,
  JoinCodeRole,
  LinkedStudentPublic,
  MemberListRole,
} from "@/lib/members/members";
import { getDisplayName } from "@/lib/user/userDisplay";
import type { Id } from "../../../convex/_generated/dataModel";

type MembersPageProps = {
  classId: Id<"classes">;
  role: MemberListRole;
  titleKey: "navTeachers" | "navAssistantTeachers" | "navStudents" | "navGuardians";
};

const MEMBERS_GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

function MembersSkeleton() {
  return (
    <div className={MEMBERS_GRID_CLASS}>
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-40 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function MembersPage({ classId, role, titleKey }: MembersPageProps) {
  const { t } = useTranslation("classes");
  const { data: currentUser } = useCurrentUser();
  const { data, isPending, isError, refetch, isAuthLoading } = useClassMembersByRole(classId, role);
  const removeMutation = useRemoveClassMember(role);
  const setRoleMutation = useSetMemberRole();
  const setLinksMutation = useSetGuardianStudentLinks();
  const [searchQuery, setSearchQuery] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<ClassMemberPublic | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const members = data ?? [];
  const { filtered } = useMemberSearch({ members: data, query: searchQuery });

  const handleRemoveRequest = useCallback((member: ClassMemberPublic) => {
    setMemberToRemove(member);
    setRemoveOpen(true);
  }, []);

  const handleRemoveConfirm = useCallback(async () => {
    if (!memberToRemove) return;
    await removeMutation.mutateAsync({
      classId,
      userId: memberToRemove.userId,
    });
  }, [classId, memberToRemove, removeMutation]);

  const removeMemberName = memberToRemove
    ? getDisplayName(
        {
          _id: memberToRemove.userId,
          name: memberToRemove.name,
          email: memberToRemove.email,
        },
        t("unnamedMember"),
      )
    : "";

  const handleChangeRole = useCallback(
    (member: ClassMemberPublic, nextRole: JoinCodeRole) => {
      void setRoleMutation.mutateAsync({
        classId,
        userId: member.userId,
        role: nextRole,
        fromRole: member.role,
      });
    },
    [classId, setRoleMutation],
  );

  const handleSetLinkedStudents = useCallback(
    (member: ClassMemberPublic, linkedStudents: LinkedStudentPublic[]) => {
      void setLinksMutation.mutateAsync({
        classId,
        guardianUserId: member.userId,
        studentUserIds: linkedStudents.map((student) => student.userId),
        linkedStudents,
      });
    },
    [classId, setLinksMutation],
  );

  const showLoaded = !isPending && !isAuthLoading && !isError;
  const showSearch = showLoaded && (members.length > 0 || searchQuery.trim().length > 0);
  const showEmpty = showLoaded && members.length === 0;
  const showNoMatches = showLoaded && members.length > 0 && filtered.length === 0;
  const showGrid = showLoaded && filtered.length > 0;

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h1>
        <p className="text-sm text-muted-foreground">{t("membersDescription")}</p>
      </div>

      {showSearch ? (
        <InputGroup className="max-w-md">
          <InputGroupInput
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("membersSearchPlaceholder")}
            aria-label={t("membersSearchLabel")}
            autoComplete="off"
            spellCheck={false}
          />
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <InputGroupText>{t("membersSearchResults", { count: filtered.length })}</InputGroupText>
            {searchQuery ? (
              <InputGroupButton
                size="icon-xs"
                aria-label={t("membersSearchClear")}
                onClick={() => setSearchQuery("")}
              >
                <XIcon />
              </InputGroupButton>
            ) : null}
          </InputGroupAddon>
        </InputGroup>
      ) : null}

      {isPending || isAuthLoading ? <MembersSkeleton /> : null}

      {!isPending && !isAuthLoading && isError ? (
        <ErrorState
          title={t("membersLoadFailed")}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {showEmpty ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>{t("membersEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("membersEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {showNoMatches ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>{t("membersSearchNoResultsTitle")}</EmptyTitle>
            <EmptyDescription>{t("membersSearchNoResults")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {showGrid ? (
        <div className={MEMBERS_GRID_CLASS}>
          {filtered.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              classId={classId}
              isSelf={currentUser?._id === member.userId}
              onRemove={handleRemoveRequest}
              onChangeRole={handleChangeRole}
              onSetLinkedStudents={role === "guardian" ? handleSetLinkedStudents : undefined}
            />
          ))}
        </div>
      ) : null}

      <RemoveMemberCredenza
        key={memberToRemove ? `remove:${memberToRemove.userId}` : "remove"}
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        memberName={removeMemberName}
        onConfirm={handleRemoveConfirm}
      />
    </div>
  );
}
