import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Card } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';

import type { Profile } from '~/types';
import { useAtomValue, useSetAtom } from 'jotai';
import { bindPasskeyAtom, credentialAtom } from '~/store/authAtom';

export const ProfileForm: React.FC<{ profile: Profile }> = ({ profile }) => {
  const [user, setUser] = useState(profile);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const credential = useAtomValue(credentialAtom);
  const bindPasskey = useSetAtom(bindPasskeyAtom);

  const handleChange = (field: string, value: string) => {
    setUser((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleResetForm = () => {
    setIsEditing(false);
    setUser(profile);
  };

  const handleBindPasskey = () => {
    bindPasskey({
      email: user.email,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    try {
      setIsSubmitting(true);
      // TODO: Update profile in Supabase
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call

      setIsEditing(false);

      toast('个人资料已更新');
    } catch (error) {
      toast.warning(error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (user || !profile) return;
    setUser(profile);
  }, [profile]);

  if (!user) {
    return null;
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <Avatar className="w-20 h-20">
            <AvatarImage src={user.avatar_url} alt={user.name} />
            <AvatarFallback>{user.name}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{user.name}</h1>
            {/* <p className="text-sm text-muted-foreground">{user.id}</p> */}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="id">ID</Label>
              <Input id="id" value={user.id} disabled className="bg-muted" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Role</Label>
              <Input id="email" value={user.role} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pssskey_id">Passkey</Label>
              <Input id="passkey_id" value={credential?.id} disabled className="bg-muted" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Name</Label>
              <Input
                id="username"
                value={user.name}
                onChange={(e) => handleChange('username', e.target.value)}
                disabled={isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={user.location}
                placeholder="Type your location here"
                onChange={(e) => handleChange('location', e.target.value)}
                disabled={isEditing}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={user.bio}
                className="min-h-[100px]"
                placeholder="Tell us a little bit about yourself"
                onChange={(e) => handleChange('bio', e.target.value)}
                disabled={isEditing}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {credential?.id ? (
            <Button type="button" variant="outline" disabled>
              Passkey 已绑定
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={handleBindPasskey}>
              绑定 Passkey
            </Button>
          )}

          {isEditing && (
            <Button
              type="button"
              variant="outline"
              onClick={handleResetForm}
              className="mr-2"
              disabled={isSubmitting}
            >
              取消
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isEditing ? '保存更改' : '编辑资料'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default ProfileForm;
