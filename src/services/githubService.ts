import { GitHubNode } from '../types';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Parses a GitHub URL or string (e.g., "owner/repo") to extract details.
 */
export const parseRepoString = (input: string): { owner: string; repo: string } | null => {
  const cleanInput = input.trim();
  
  // Handle full URL
  try {
    const url = new URL(cleanInput);
    if (url.hostname === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return { owner: parts[0], repo: parts[1] };
      }
    }
  } catch (e) {
    // Not a URL, try owner/repo format
  }

  const parts = cleanInput.split('/');
  if (parts.length === 2) {
    return { owner: parts[0], repo: parts[1] };
  }

  return null;
};

/**
 * Fetches the contents of a directory in a repository.
 */
export const fetchRepoContents = async (owner: string, repo: string, path: string = ''): Promise<GitHubNode[]> => {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`);
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("API Rate limit exceeded. Please try again later.");
      }
      if (response.status === 404) {
        throw new Error("Repository or path not found.");
      }
      throw new Error(`GitHub API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // If data is not an array, it might be a single file object if path pointed to a file
    if (!Array.isArray(data)) {
      return [data];
    }

    // Sort: Directories first, then files
    return data.sort((a: GitHubNode, b: GitHubNode) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'dir' ? -1 : 1;
    });
  } catch (error) {
    console.error("Error fetching repo contents:", error);
    throw error;
  }
};

/**
 * Fetches the raw content of a file.
 */
export const fetchFileContent = async (downloadUrl: string): Promise<string> => {
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
       throw new Error(`Failed to fetch file content: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error("Error fetching file content:", error);
    throw error;
  }
};
