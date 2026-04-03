import { useEffect, useState } from "react";
import api from "../api/client";
import Loading from "../components/Loading";

export default function MethodologyPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/methodology/").then((res) => setData(res.data));
  }, []);

  if (!data) return <Loading label="Loading methodology..." />;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Methodology</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {data.cards.map((card) => (
          <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{card.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Tech Stack</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2">Layer</th>
              <th className="py-2">Technology</th>
            </tr>
          </thead>
          <tbody>
            {data.stack.map((row) => (
              <tr key={row.layer} className="border-b border-slate-100">
                <td className="py-2 font-medium">{row.layer}</td>
                <td className="py-2">{row.tech}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
