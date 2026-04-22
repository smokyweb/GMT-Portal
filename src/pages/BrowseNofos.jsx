import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { FileText, Calendar, DollarSign, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDateShort } from '../lib/helpers';

export default function BrowseNofos() {
  const [nofos, setNofos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Nofo.filter({ status: 'Published' }, '-created_date', 50).then(n => {
      setNofos(n);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Browse Funding Opportunities</h1>
        <p className="text-muted-foreground text-sm mt-1">View all open Notices of Funding Opportunity</p>
      </div>

      {nofos.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-lg mb-1">No Open Opportunities</h3>
          <p className="text-muted-foreground text-sm">Check back later for new funding opportunities.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {nofos.map(nofo => (
            <div key={nofo.id} className="bg-card rounded-xl border p-6 hover:shadow-lg transition-shadow space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">{nofo.program_code}</span>
                  <h3 className="font-bold text-lg mt-2">{nofo.title}</h3>
                </div>
              </div>
              {nofo.summary && <p className="text-sm text-muted-foreground line-clamp-2">{nofo.summary}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Total Funding</p>
                    <p className="font-bold">{formatCurrency(nofo.total_funding_available)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Award Range</p>
                    <p className="font-medium">{formatCurrency(nofo.min_award)} – {formatCurrency(nofo.max_award)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Application window: {formatDateShort(nofo.open_date)} – {formatDateShort(nofo.close_date)}</span>
              </div>
              {nofo.required_documents?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Required Documents:</p>
                  <div className="flex flex-wrap gap-1">
                    {nofo.required_documents.map((doc, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-muted text-xs">
                        {doc.name} {doc.mandatory && <span className="text-red-500">*</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <Link to={`/new-application?nofo=${nofo.id}`}>
                <Button className="w-full">
                  Start Application <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}