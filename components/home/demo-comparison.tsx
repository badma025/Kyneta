import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const traditionalPrompt =
  "A 5 kg block is pushed across a frictionless horizontal surface by a constant 15 N force. What is the block's acceleration?";

const kynetaPrompt =
  "An object receives a steady push. Each increase in push changes motion in direct proportion, while greater mass resists that change. What happens to the rate of change in motion when the push stays fixed and the mass rises?";

export function DemoComparison() {
  return (
    <section className="grid border border-[#232B27] md:grid-cols-[1fr_1px_1fr]">
      <div className="space-y-6 p-6 opacity-50 sm:p-8">
        <div className="font-mono text-xs uppercase tracking-[0.24em] text-[#7A8A82]">
          Traditional
        </div>
        <p className="max-w-xl text-sm leading-7 text-[#E0E6E3] sm:text-base">
          {traditionalPrompt}
        </p>
      </div>
      <div className="hidden bg-[#232B27] md:block" />
      <div className="space-y-6 border-t border-[#232B27] p-6 md:border-t-0 sm:p-8">
        <div className="font-mono text-xs uppercase tracking-[0.24em] text-[#3CD070]">
          Kyneta
        </div>
        <p className="max-w-xl font-mono text-sm leading-7 text-[#E0E6E3] sm:text-base">
          {kynetaPrompt}
        </p>
      </div>
      <div className="md:col-span-3 border-t border-[#232B27] p-6 sm:p-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Signal</TableHead>
              <TableHead>Traditional</TableHead>
              <TableHead className="text-[#3CD070]">Kyneta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono text-xs uppercase tracking-[0.18em] text-[#7A8A82]">
                Surface
              </TableCell>
              <TableCell>Physics label + unit-heavy framing</TableCell>
              <TableCell>Abstract causal structure only</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-xs uppercase tracking-[0.18em] text-[#7A8A82]">
                Skill
              </TableCell>
              <TableCell>Chapter recall</TableCell>
              <TableCell>Reasoning under pressure</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
