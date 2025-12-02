import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Printer } from 'lucide-react';
import { PrintOptions, PrintColorMode, PrintSides, BindingType } from '@/types/print';

interface PrintRequestFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (options: PrintOptions) => Promise<void>;
  submissionTitle: string;
}

export function PrintRequestForm({ open, onClose, onSubmit, submissionTitle }: PrintRequestFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PrintOptions>({
    colorMode: 'bw',
    sides: 'single',
    binding: 'none',
    copies: 1,
    additionalNotes: '',
  });

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await onSubmit(formData);
      onClose();
      // Reset form
      setFormData({
        colorMode: 'bw',
        sides: 'single',
        binding: 'none',
        copies: 1,
        additionalNotes: '',
      });
    } catch (error) {
      console.error('Error submitting print request:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Request Details
          </DialogTitle>
          <DialogDescription>
            Configure print settings for: <strong>{submissionTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Color Mode */}
          <div className="space-y-2">
            <Label>Color Mode</Label>
            <RadioGroup
              value={formData.colorMode}
              onValueChange={(value) => setFormData({ ...formData, colorMode: value as PrintColorMode })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bw" id="bw" />
                <Label htmlFor="bw" className="font-normal cursor-pointer">
                  Black & White
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="color" id="color" />
                <Label htmlFor="color" className="font-normal cursor-pointer">
                  Color
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Print Sides */}
          <div className="space-y-2">
            <Label>Print Sides</Label>
            <RadioGroup
              value={formData.sides}
              onValueChange={(value) => setFormData({ ...formData, sides: value as PrintSides })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single" id="single" />
                <Label htmlFor="single" className="font-normal cursor-pointer">
                  Single Sided
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="double" id="double" />
                <Label htmlFor="double" className="font-normal cursor-pointer">
                  Double Sided (Both Sides)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Binding Type */}
          <div className="space-y-2">
            <Label htmlFor="binding">Binding Type</Label>
            <Select
              value={formData.binding}
              onValueChange={(value) => setFormData({ ...formData, binding: value as BindingType })}
            >
              <SelectTrigger id="binding">
                <SelectValue placeholder="Select binding type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Binding</SelectItem>
                <SelectItem value="staple">Staple</SelectItem>
                <SelectItem value="soft-bind">Soft Bind</SelectItem>
                <SelectItem value="spiral-bind">Spiral Bind</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Number of Copies */}
          <div className="space-y-2">
            <Label htmlFor="copies">Number of Copies</Label>
            <Input
              id="copies"
              type="number"
              min="1"
              max="10"
              value={formData.copies}
              onChange={(e) => setFormData({ ...formData, copies: parseInt(e.target.value) || 1 })}
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any special instructions for the reprography team..."
              value={formData.additionalNotes}
              onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                Submit Print Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
