import React from 'react';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../auth/AuthContext';

interface PlaceholderProps {
  title: string;
  stitchId?: string;
  route: string;
  note?: string;
}

export const PlaceholderPage: React.FC<PlaceholderProps> = ({
  title,
  stitchId,
  route,
  note,
}) => {
  const { currentUser } = useAuth();

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-bold text-slate-900 m-0">{title}</h2>
        <Badge label={currentUser.nhanHienThi} variant="blue" />
      </div>

      <div className="space-y-3 text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div>
          <span className="font-semibold text-slate-700">Đường dẫn: </span>
          <code className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs">
            {route}
          </code>
        </div>
        {stitchId && (
          <div>
            <span className="font-semibold text-slate-700">Stitch ID: </span>
            <code className="text-slate-700 bg-slate-200/60 px-2 py-0.5 rounded text-xs">
              {stitchId}
            </code>
          </div>
        )}
        {note && (
          <div>
            <span className="font-semibold text-slate-700">Ghi chú: </span>
            <span>{note}</span>
          </div>
        )}
      </div>
    </div>
  );
};
