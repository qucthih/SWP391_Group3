/**
 * Git Analytics contract for US-11.
 * Parses commit counts and LOC per team member from a GitHub repository URL.
 */

export interface MemberStats {
  /** Git author name */
  author: string;
  /** Number of commits by this author */
  commits: number;
  /** Total lines added */
  additions: number;
  /** Total lines deleted */
  deletions: number;
}

export interface GitAnalyticsResult {
  /** Repository owner/name */
  repository: string;
  /** Total number of commits in the repository */
  totalCommits: number;
  /** Per-member statistics */
  memberStats: MemberStats[];
  /** When the analysis was performed */
  analyzedAt: string;
}
