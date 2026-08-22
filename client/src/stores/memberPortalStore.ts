import { create } from "zustand";

export const MEMBER_ACCESS_TOKEN_KEY = "pos-member-access-token";

export type PortalMember = {
  id: number;
  memberNumber: string;
  firstName: string;
  lastName: string;
};

type MemberPortalState = {
  accessToken: string | null;
  member: PortalMember | null;
  points: number;
  setSession: (session: { accessToken: string; member: PortalMember; points: number }) => void;
  clearSession: () => void;
};

export const useMemberPortalStore = create<MemberPortalState>(set => ({
  accessToken: typeof window === "undefined" ? null : sessionStorage.getItem(MEMBER_ACCESS_TOKEN_KEY),
  member: null,
  points: 0,
  setSession: session => {
    sessionStorage.setItem(MEMBER_ACCESS_TOKEN_KEY, session.accessToken);
    set({ accessToken: session.accessToken, member: session.member, points: session.points });
  },
  clearSession: () => {
    sessionStorage.removeItem(MEMBER_ACCESS_TOKEN_KEY);
    set({ accessToken: null, member: null, points: 0 });
  },
}));

export const getMemberAccessToken = () => typeof window === "undefined" ? null : sessionStorage.getItem(MEMBER_ACCESS_TOKEN_KEY);
