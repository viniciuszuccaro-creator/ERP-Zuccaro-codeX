/**
 * Entrada `/Home` (placeholder gerado).
 * Causa: arquivo só com ProtectedSection vazia — rota órfã do Dashboard canônico.
 * Recuperação: reusa `Dashboard` (mainPage + menu), sem shell paralelo.
 */
import Dashboard from './Dashboard';

export default function Home(props) {
  return (
    <div className="w-full h-full">
      <Dashboard {...props} />
    </div>
  );
}
