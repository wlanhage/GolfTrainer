'use client';

type Props = {
  avatarImage?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: number;
};

export function UserAvatar({ avatarImage, displayName, email, size = 40 }: Props) {
  const initial = (displayName ?? email ?? 'G').trim().charAt(0).toUpperCase();
  if (avatarImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarImage} alt="" style={{ width: size, height: size, borderRadius: size / 2, objectFit: 'cover' }} />;
  }
  return (
    <div
      className="inline-flex items-center justify-center bg-slate-800 text-white font-bold"
      style={{ width: size, height: size, borderRadius: size / 2, fontSize: Math.max(14, size * 0.38) }}
    >
      {initial}
    </div>
  );
}
