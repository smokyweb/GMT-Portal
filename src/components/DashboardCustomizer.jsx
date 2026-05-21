import { useState } from 'react';
import { Settings, X, GripVertical, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function DashboardCustomizer({ widgets, onSave }) {
  const [open, setOpen] = useState(false);
  const [localWidgets, setLocalWidgets] = useState(widgets);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const handleOpen = () => {
    setLocalWidgets(widgets);
    setOpen(true);
  };

  const toggleWidget = (id) => {
    setLocalWidgets(prev =>
      prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w)
    );
  };

  const handleDragStart = (e, index) => {
    setDragging(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(index);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (dragging === null || dragging === index) return;
    const updated = [...localWidgets];
    const [moved] = updated.splice(dragging, 1);
    updated.splice(index, 0, moved);
    setLocalWidgets(updated);
    setDragging(null);
    setDragOver(null);
  };

  const handleSave = () => {
    onSave(localWidgets);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen} className="gap-2">
        <Settings className="h-4 w-4" />
        Customize
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Customize Dashboard</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Toggle widgets on/off and drag to reorder them.
          </p>
          <div className="space-y-2 mt-2 max-h-96 overflow-y-auto pr-1">
            {localWidgets.map((widget, index) => (
              <div
                key={widget.id}
                draggable
                onDragStart={e => handleDragStart(e, index)}
                onDragOver={e => handleDragOver(e, index)}
                onDrop={e => handleDrop(e, index)}
                onDragEnd={() => { setDragging(null); setDragOver(null); }}
                className={`flex items-center gap-3 p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-all ${
                  dragOver === index ? 'border-primary bg-primary/5 scale-[1.02]' : ''
                } ${dragging === index ? 'opacity-40' : ''}`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{widget.label}</p>
                  {widget.description && (
                    <p className="text-xs text-muted-foreground">{widget.description}</p>
                  )}
                </div>
                <button
                  onClick={() => toggleWidget(widget.id)}
                  className={`p-1.5 rounded-md transition-colors ${
                    widget.visible
                      ? 'text-primary hover:bg-primary/10'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {widget.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Layout</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}