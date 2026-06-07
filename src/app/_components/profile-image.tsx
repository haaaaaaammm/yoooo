import { resolveProfileImageUrl } from "@/lib/profile-image";

type ProfileImageProps = {
  className: string;
  profileImageUrl?: string | null;
};

export default function ProfileImage({
  className,
  profileImageUrl,
}: ProfileImageProps) {
  return (
    <img
      alt="Profile picture"
      className={className}
      height={40}
      src={resolveProfileImageUrl(profileImageUrl)}
      width={40}
    />
  );
}
