import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export function ProfileSettings() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dept: '',
    regNo: '',
    branch: '',
    empId: '',
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        dept: userProfile.dept || '',
        regNo: 'regNo' in userProfile ? userProfile.regNo : '',
        branch: 'branch' in userProfile ? userProfile.branch || '' : '',
        empId: 'empId' in userProfile ? userProfile.empId : '',
      });
    }
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userProfile) return;

    try {
      setLoading(true);

      // Determine collection based on role
      let collection = 'students';
      if (userProfile.role === 'teacher') collection = 'teachers';
      if (userProfile.role === 'reprography_admin') collection = 'reprography_admins';

      // Prepare update data
      const updateData: any = {
        name: formData.name,
        dept: formData.dept,
      };

      if (userProfile.role === 'student') {
        // Don't update regNo as it's immutable
        // Sync branch with dept since they're the same
        updateData.branch = formData.dept;
      } else {
        updateData.empId = formData.empId;
      }

      // Update Firestore
      const userDocRef = doc(db, collection, userProfile.uid);
      await updateDoc(userDocRef, updateData);

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      // Reload page to refresh user data
      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!userProfile) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full bg-background">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-academic-navy mb-2">Profile Settings</h2>
          <p className="text-academic-gray">
            Update your profile information
          </p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Email cannot be changed for security reasons
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={userProfile.email}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-muted-foreground">Email cannot be modified</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dept">Department/Branch *</Label>
                <Select
                  value={formData.dept}
                  onValueChange={(value) => setFormData({ ...formData, dept: value, branch: value })}
                  disabled={loading}
                >
                  <SelectTrigger id="dept">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Computer Science">Computer Science</SelectItem>
                    <SelectItem value="Electronics">Electronics & Communication</SelectItem>
                    <SelectItem value="Electrical">Electrical & Electronics</SelectItem>
                    <SelectItem value="Mechanical">Mechanical Engineering</SelectItem>
                    <SelectItem value="Civil">Civil Engineering</SelectItem>
                    <SelectItem value="Information Science">Information Science</SelectItem>
                    <SelectItem value="AI & ML">Artificial Intelligence & Machine Learning</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {userProfile.role === 'student' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="regNo">Registration Number (USN)</Label>
                    <Input
                      id="regNo"
                      type="text"
                      value={formData.regNo}
                      disabled
                      className="bg-gray-100"
                    />
                    <p className="text-xs text-muted-foreground">USN cannot be modified</p>
                  </div>
                </>
              )}

              {(userProfile.role === 'teacher' || userProfile.role === 'reprography_admin') && (
                <div className="space-y-2">
                  <Label htmlFor="empId">Employee ID *</Label>
                  <Input
                    id="empId"
                    type="text"
                    value={formData.empId}
                    onChange={(e) => setFormData({ ...formData, empId: e.target.value })}
                    disabled={loading}
                    required
                  />
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
