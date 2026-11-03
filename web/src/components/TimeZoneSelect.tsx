export const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const zoneNames = Intl.supportedValuesOf("timeZone");
const timeZones = zoneNames.includes(browserTimeZone) ? zoneNames : [browserTimeZone, ...zoneNames];

export function TimeZoneSelect({ name, defaultValue }: { name: string; defaultValue: string }) {
  return (
    <select name={name} defaultValue={defaultValue}>
      {timeZones.map((zone) => <option key={zone}>{zone}</option>)}
    </select>
  );
}
