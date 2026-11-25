import type { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { boundaryAreaKm2, directMandateParty, electionDistrictNumberLabel } from '../mapModel';

/**
 * Text alternative to the map. Every district the map shows is also readable as
 * a row, so keyboard and screen-reader users do not depend on colour or pointer.
 */
export function DistrictDataTable({
  districts,
  caption,
  onSelect,
  className,
}: {
  districts: ElectionDistrict[];
  caption: string;
  onSelect?: (district: ElectionDistrict) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b text-muted-foreground">
            <th scope="col" className="py-1 pr-2 font-medium">Nr.</th>
            <th scope="col" className="py-1 pr-2 font-medium">Wahlkreis</th>
            <th scope="col" className="py-1 pr-2 font-medium">Direktmandat</th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">Fläche</th>
            <th scope="col" className="py-1 text-right font-medium">Einwohner</th>
          </tr>
        </thead>
        <tbody>
          {districts.map(district => {
            const direct = district.representatives?.find(rep => rep.mandate_type === 'direct');
            const area = boundaryAreaKm2(district.boundaries);
            return (
              <tr key={district.id} className="border-b border-border/50 align-top">
                <td className="py-1 pr-2 tabular-nums">{electionDistrictNumberLabel(district)}</td>
                <th scope="row" className="py-1 pr-2 font-normal">
                  {onSelect ? (
                    <button
                      type="button"
                      className="text-left hover:underline focus-visible:ring-1 focus-visible:ring-ring"
                      onClick={() => onSelect(district)}
                    >
                      {district.district_name}
                    </button>
                  ) : (
                    district.district_name
                  )}
                </th>
                <td className="py-1 pr-2">
                  {direct ? `${direct.name} (${direct.party})` : directMandateParty(district)}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums">
                  {area != null ? `${area.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km²` : '–'}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {district.population?.toLocaleString('de-DE') ?? '–'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
