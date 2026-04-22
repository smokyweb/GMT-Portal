import { useState } from 'react';
import moment from 'moment';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from './StatusBadge';

export default function MilestoneCalendar({ milestones, applicationId = null }) {
  const [currentDate, setCurrentDate] = useState(moment());
  const filtered = applicationId
    ? milestones.filter(m => m.application_id === applicationId)
    : milestones;

  const daysInMonth = currentDate.daysInMonth();
  const firstDay = currentDate.clone().startOf('month').day();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getMilestonesForDay = (day) => {
    if (!day) return [];
    const dateStr = currentDate.clone().date(day).format('YYYY-MM-DD');
    return filtered.filter(m => m.due_date === dateStr);
  };

  return (
    <div className="bg-card border rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{currentDate.format('MMMM YYYY')}</h3>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentDate(currentDate.clone().subtract(1, 'month'))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentDate(moment())}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentDate(currentDate.clone().add(1, 'month'))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const milestones = getMilestonesForDay(day);
          const isToday = day && currentDate.clone().date(day).isSame(moment(), 'day');
          return (
            <div
              key={idx}
              className={`min-h-16 p-1 rounded border text-xs ${
                !day
                  ? 'bg-muted/30'
                  : isToday
                  ? 'bg-primary/10 border-primary/30'
                  : 'bg-muted/10'
              }`}
            >
              {day && (
                <>
                  <div className={`font-medium mb-0.5 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {milestones.slice(0, 2).map(m => (
                      <div
                        key={m.id}
                        className={`px-1 py-0.5 rounded text-[10px] font-medium truncate
                          ${m.status === 'Completed' ? 'bg-green-100 text-green-700' :
                            m.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                            m.status === 'InProgress' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'}`}
                        title={m.title}
                      >
                        {m.title}
                      </div>
                    ))}
                    {milestones.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{milestones.length - 2} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}