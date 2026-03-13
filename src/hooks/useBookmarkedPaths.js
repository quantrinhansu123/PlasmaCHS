import { useCallback, useMemo, useState } from 'react';

const STORAGE_KEY = 'plasmavn_bookmarked_paths_v1';

const readStoredBookmarks = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export default function useBookmarkedPaths() {
  const [bookmarkedPaths, setBookmarkedPaths] = useState(readStoredBookmarks);

  const persist = useCallback((nextPaths) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPaths));
    }
    setBookmarkedPaths(nextPaths);
  }, []);

  const toggleBookmark = useCallback(
    (path) => {
      if (!path) {
        return;
      }

      const isSaved = bookmarkedPaths.includes(path);
      const nextPaths = isSaved
        ? bookmarkedPaths.filter((savedPath) => savedPath !== path)
        : [...bookmarkedPaths, path];

      persist(nextPaths);
    },
    [bookmarkedPaths, persist]
  );

  const bookmarkedSet = useMemo(() => new Set(bookmarkedPaths), [bookmarkedPaths]);

  const isBookmarked = useCallback((path) => bookmarkedSet.has(path), [bookmarkedSet]);

  return {
    bookmarkedPaths,
    isBookmarked,
    toggleBookmark,
  };
}
