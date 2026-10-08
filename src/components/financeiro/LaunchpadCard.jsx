import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const COLOR_CLASSES = Object.freeze({
  blue: 'from-blue-500 to-blue-600 hover:shadow-blue-200',
  green: 'from-green-500 to-green-600 hover:shadow-green-200',
  red: 'from-red-500 to-red-600 hover:shadow-red-200',
  purple: 'from-purple-500 to-purple-600 hover:shadow-purple-200',
  orange: 'from-orange-500 to-orange-600 hover:shadow-orange-200',
  cyan: 'from-cyan-500 to-cyan-600 hover:shadow-cyan-200',
  emerald: 'from-emerald-500 to-emerald-600 hover:shadow-emerald-200',
  indigo: 'from-indigo-500 to-indigo-600 hover:shadow-indigo-200',
  pink: 'from-pink-500 to-pink-600 hover:shadow-pink-200',
  teal: 'from-teal-500 to-teal-600 hover:shadow-teal-200',
  violet: 'from-violet-500 to-violet-600 hover:shadow-violet-200',
  rose: 'from-rose-500 to-rose-600 hover:shadow-rose-200',
});

export default function LaunchpadCard({
  title,
  description,
  icon: Icon,
  onClick,
  color = 'blue',
  badge,
  badgeVariant = 'default',
  dataPermission,
  dataAction
}) {
  void badgeVariant;
  const gradient = COLOR_CLASSES[color] || COLOR_CLASSES.blue;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onClick?.(e);
        }
      }}
      data-permission={dataPermission}
      data-action={dataAction}
      data-launchpad-color={COLOR_CLASSES[color] ? color : 'blue'}
      className={`
        w-full min-w-0 min-h-[140px] 
        cursor-pointer 
        border-0 
        bg-gradient-to-br ${gradient} 
        text-white
        transition-shadow duration-200
        hover:shadow-xl
        relative
        overflow-hidden
        isolate
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400
      `}>
      
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-12 -mb-12 pointer-events-none" />
      
      <CardContent className="bg-transparent p-5 relative z-10 flex flex-col h-full justify-between min-h-[140px]">
        <div className="flex items-start justify-between mb-3">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-white" />
          </div>
          {badge &&
          <Badge className="bg-white/30 text-white border-white/50">
              {badge}
            </Badge>
          }
        </div>
        
        <div>
          <h3 className="text-lg font-bold mb-1">{title}</h3>
          <p className="text-sm text-white/90 leading-tight">{description}</p>
        </div>
      </CardContent>
    </Card>);

}
