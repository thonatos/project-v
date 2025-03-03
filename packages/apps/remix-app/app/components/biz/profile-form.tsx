import { useEffect, useState } from 'react';

import { Card } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { useToast } from '~/hooks/use-toast';

import { User } from '~/types';

export const ProfileForm: React.FC<{ profile: User }> = ({ profile }) => {
  const [user, setUser] = useState(profile);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleChange = (field: string, value: string) => {
    setUser((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleReset = () => {
    setIsEditing(false);
    setUser(profile);
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
      toast({
        title: '个人资料已更新',
      });
    } catch (error) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
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
            <p className="text-sm text-muted-foreground">{user.id}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Role</Label>
              <Input id="email" value={user.role} disabled className="bg-muted" />
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

        <div className="flex justify-end">
          {isEditing && (
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
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
