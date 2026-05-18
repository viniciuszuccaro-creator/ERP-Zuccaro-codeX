import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export default function QuickAccessModulesGrid({ modules, onClick }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-4">Acesso Rápido aos Módulos</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {modules.map((module, index) => (
          <Card
            key={index}
            onClick={() => onClick(module.url)}
            data-permission={module.permission}
            data-action={`Dashboard.abrir.${module.title}`}
            className="hover:shadow-xl transition-all duration-300 border-0 overflow-hidden group cursor-pointer h-full"
          >
            <div className={`h-2 bg-gradient-to-r ${module.color}`} />
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-4 rounded-xl bg-gradient-to-br ${module.color} shadow-lg group-hover:scale-110 transition-transform`}>
                  <module.icon className="w-8 h-8 text-white" />
                </div>
                {module.count !== null && (
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${module.alert ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                    {module.count}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{module.title}</h3>
              <p className="text-slate-600 text-sm mb-4">{module.description}</p>
              <div className="flex items-center text-blue-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                Acessar <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
