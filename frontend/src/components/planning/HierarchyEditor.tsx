import { useState, useCallback } from 'react';
import {
  Building2,
  Landmark,
  FileText,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type {
  CustomRegionInput,
  ContractInput,
  CouncilInput,
  DNORegion,
} from '../../api/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HierarchyEditorProps {
  hierarchy: CustomRegionInput[];
  onChange: (hierarchy: CustomRegionInput[]) => void;
  dnoRegions: DNORegion[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONTRACT: ContractInput = {
  name: 'New Contract',
  status: 'active',
  dno_regions: [],
  contractors: 2,
  team_size_per_contractor: 4,
  max_sites_per_team_per_month: 2,
  lead_time_months: 2,
  build_time_days: 30,
  target_sites: 10,
  priority: 5,
  capex_bom: 10000,
  capex_dno: 5000,
  capex_survey: 2000,
  capex_council: 3000,
  opex_per_site: 1000,
  revenue_per_site: 15000,
  redundancy_percent: 0,
  contingency_percent: 10,
};

const DEFAULT_COUNCIL: CouncilInput = {
  name: 'New Council',
  code: '',
  contracts: [],
};

const DEFAULT_REGION: CustomRegionInput = {
  name: 'New Region',
  code: '',
  description: '',
  default_capex_bom: 10000,
  default_capex_dno: 5000,
  default_capex_survey: 2000,
  default_capex_council: 3000,
  default_opex: 1000,
  default_revenue_per_site: 15000,
  councils: [],
};

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const LABEL_CLS = 'block text-xs font-medium text-gray-500 mb-1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a new contract pre-filled from council defaults (falling back to region defaults). */
function newContractFromDefaults(
  council: CouncilInput,
  region: CustomRegionInput,
): ContractInput {
  return {
    ...DEFAULT_CONTRACT,
    capex_bom: council.default_capex_bom ?? region.default_capex_bom,
    capex_dno: council.default_capex_dno ?? region.default_capex_dno,
    capex_survey: council.default_capex_survey ?? region.default_capex_survey,
    capex_council: council.default_capex_council ?? region.default_capex_council,
    opex_per_site: council.default_opex ?? region.default_opex,
    revenue_per_site:
      council.default_revenue_per_site ?? region.default_revenue_per_site,
  };
}

// ---------------------------------------------------------------------------
// Contract Card
// ---------------------------------------------------------------------------

interface ContractCardProps {
  contract: ContractInput;
  contractIdx: number;
  dnoRegions: DNORegion[];
  onUpdate: (idx: number, contract: ContractInput) => void;
  onRemove: (idx: number) => void;
}

function ContractCard({
  contract,
  contractIdx,
  dnoRegions,
  onUpdate,
  onRemove,
}: ContractCardProps) {
  const [expanded, setExpanded] = useState(false);

  const set = (field: keyof ContractInput, value: unknown) => {
    onUpdate(contractIdx, { ...contract, [field]: value });
  };

  const toggleDno = (code: string) => {
    const next = contract.dno_regions.includes(code)
      ? contract.dno_regions.filter((c) => c !== code)
      : [...contract.dno_regions, code];
    set('dno_regions', next);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <FileText className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-900">
            {contract.name}
          </span>
          {contract.reference && (
            <span className="text-xs text-gray-400">
              ({contract.reference})
            </span>
          )}
          <span
            className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              contract.status === 'active'
                ? 'bg-green-100 text-green-700'
                : contract.status === 'paused'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {contract.status}
          </span>
        </button>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{contract.target_sites} sites</span>
          <span>&middot;</span>
          <span>P{contract.priority}</span>
        </div>
        <button
          onClick={() => onRemove(contractIdx)}
          className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="Remove contract"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-5">
          {/* Identity */}
          <fieldset>
            <legend className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Identity
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={LABEL_CLS}>Name</label>
                <input
                  type="text"
                  value={contract.name}
                  onChange={(e) => set('name', e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Reference</label>
                <input
                  type="text"
                  value={contract.reference ?? ''}
                  onChange={(e) => set('reference', e.target.value || undefined)}
                  placeholder="Optional ref"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Status</label>
                <select
                  value={contract.status}
                  onChange={(e) => set('status', e.target.value)}
                  className={INPUT_CLS}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* DNO Regions */}
          <fieldset>
            <legend className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              DNO Regions
            </legend>
            <div className="flex flex-wrap gap-2">
              {dnoRegions.map((dno) => (
                <label
                  key={dno.code}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={contract.dno_regions.includes(dno.code)}
                    onChange={() => toggleDno(dno.code)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {dno.name}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Capacity */}
          <fieldset>
            <legend className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Capacity
            </legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className={LABEL_CLS}>Contractors</label>
                <input
                  type="number"
                  min={1}
                  value={contract.contractors}
                  onChange={(e) =>
                    set('contractors', parseInt(e.target.value, 10) || 1)
                  }
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Team Size / Contractor</label>
                <input
                  type="number"
                  min={1}
                  value={contract.team_size_per_contractor}
                  onChange={(e) =>
                    set(
                      'team_size_per_contractor',
                      parseInt(e.target.value, 10) || 1,
                    )
                  }
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Max Sites/Team/Month</label>
                <input
                  type="number"
                  min={1}
                  value={contract.max_sites_per_team_per_month}
                  onChange={(e) =>
                    set(
                      'max_sites_per_team_per_month',
                      parseInt(e.target.value, 10) || 1,
                    )
                  }
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Lead Time (months)</label>
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={contract.lead_time_months}
                  onChange={(e) =>
                    set('lead_time_months', parseInt(e.target.value, 10) || 0)
                  }
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Build Time (days)</label>
                <input
                  type="number"
                  min={1}
                  value={contract.build_time_days}
                  onChange={(e) =>
                    set('build_time_days', parseInt(e.target.value, 10) || 1)
                  }
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Target Sites</label>
                <input
                  type="number"
                  min={0}
                  value={contract.target_sites}
                  onChange={(e) =>
                    set('target_sites', parseInt(e.target.value, 10) || 0)
                  }
                  className={INPUT_CLS}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_CLS}>
                  Priority: {contract.priority}/10
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={contract.priority}
                  onChange={(e) =>
                    set('priority', parseInt(e.target.value, 10))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </fieldset>

          {/* Cost Breakdown */}
          <fieldset>
            <legend className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Cost Breakdown
            </legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  ['capex_bom', 'CAPEX BOM'],
                  ['capex_dno', 'CAPEX DNO'],
                  ['capex_survey', 'CAPEX Survey'],
                  ['capex_council', 'CAPEX Council'],
                  ['opex_per_site', 'OPEX / Site'],
                  ['revenue_per_site', 'Revenue / Site'],
                ] as const
              ).map(([field, label]) => (
                <div key={field}>
                  <label className={LABEL_CLS}>{label} (&pound;)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={contract[field]}
                    onChange={(e) =>
                      set(field, parseFloat(e.target.value) || 0)
                    }
                    className={INPUT_CLS}
                  />
                </div>
              ))}
            </div>
          </fieldset>

          {/* Contingency */}
          <fieldset>
            <legend className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Contingency
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL_CLS}>
                  Redundancy: {contract.redundancy_percent}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={25}
                  value={contract.redundancy_percent}
                  onChange={(e) =>
                    set('redundancy_percent', parseInt(e.target.value, 10))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className={LABEL_CLS}>
                  Contingency: {contract.contingency_percent}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={25}
                  value={contract.contingency_percent}
                  onChange={(e) =>
                    set('contingency_percent', parseInt(e.target.value, 10))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Council Card
// ---------------------------------------------------------------------------

interface CouncilCardProps {
  council: CouncilInput;
  councilIdx: number;
  region: CustomRegionInput;
  dnoRegions: DNORegion[];
  onUpdate: (idx: number, council: CouncilInput) => void;
  onRemove: (idx: number) => void;
}

function CouncilCard({
  council,
  councilIdx,
  region,
  dnoRegions,
  onUpdate,
  onRemove,
}: CouncilCardProps) {
  const [expanded, setExpanded] = useState(false);

  const set = (field: keyof CouncilInput, value: unknown) => {
    onUpdate(councilIdx, { ...council, [field]: value });
  };

  const updateContract = useCallback(
    (idx: number, updated: ContractInput) => {
      const next = [...council.contracts];
      next[idx] = updated;
      onUpdate(councilIdx, { ...council, contracts: next });
    },
    [council, councilIdx, onUpdate],
  );

  const removeContract = useCallback(
    (idx: number) => {
      onUpdate(councilIdx, {
        ...council,
        contracts: council.contracts.filter((_, i) => i !== idx),
      });
    },
    [council, councilIdx, onUpdate],
  );

  const addContract = useCallback(() => {
    const newContract = newContractFromDefaults(council, region);
    onUpdate(councilIdx, {
      ...council,
      contracts: [...council.contracts, newContract],
    });
  }, [council, councilIdx, region, onUpdate]);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <Landmark className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-medium text-gray-900">
            {council.name}
          </span>
          {council.code && (
            <span className="text-xs text-gray-400">({council.code})</span>
          )}
        </button>
        <span className="text-xs text-gray-500">
          {council.contracts.length} contract
          {council.contracts.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => onRemove(councilIdx)}
          className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="Remove council"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          {/* Council fields */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={LABEL_CLS}>Name</label>
              <input
                type="text"
                value={council.name}
                onChange={(e) => set('name', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Code</label>
              <input
                type="text"
                value={council.code}
                onChange={(e) =>
                  set(
                    'code',
                    e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
                  )
                }
                placeholder="e.g. WESTMINSTER"
                className={`${INPUT_CLS} font-mono`}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Contact Info</label>
              <input
                type="text"
                value={council.contact_info ?? ''}
                onChange={(e) =>
                  set('contact_info', e.target.value || undefined)
                }
                placeholder="Optional"
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Council cost overrides */}
          <div>
            <p className="text-xs text-gray-400 mb-2">
              Cost overrides (leave blank to inherit from region)
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  ['default_capex_bom', 'BOM'],
                  ['default_capex_dno', 'DNO'],
                  ['default_capex_survey', 'Survey'],
                  ['default_capex_council', 'Council'],
                  ['default_opex', 'OPEX'],
                  ['default_revenue_per_site', 'Revenue'],
                ] as const
              ).map(([field, label]) => (
                <div key={field}>
                  <label className={LABEL_CLS}>{label} (&pound;)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={council[field] ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      set(field, raw === '' ? undefined : parseFloat(raw) || 0);
                    }}
                    placeholder={String(
                      region[
                        field === 'default_opex'
                          ? 'default_opex'
                          : field === 'default_revenue_per_site'
                          ? 'default_revenue_per_site'
                          : (field as keyof CustomRegionInput)
                      ] ?? '',
                    )}
                    className={INPUT_CLS}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Contracts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Contracts
              </h4>
              <button
                onClick={addContract}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Contract
              </button>
            </div>

            {council.contracts.length === 0 && (
              <p className="text-xs text-gray-400 italic py-2">
                No contracts yet. Click &ldquo;Add Contract&rdquo; to get
                started.
              </p>
            )}

            {council.contracts.map((contract, cIdx) => (
              <ContractCard
                key={cIdx}
                contract={contract}
                contractIdx={cIdx}
                dnoRegions={dnoRegions}
                onUpdate={updateContract}
                onRemove={removeContract}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Region Card
// ---------------------------------------------------------------------------

interface RegionCardProps {
  region: CustomRegionInput;
  regionIdx: number;
  dnoRegions: DNORegion[];
  onUpdate: (idx: number, region: CustomRegionInput) => void;
  onRemove: (idx: number) => void;
}

function RegionCard({
  region,
  regionIdx,
  dnoRegions,
  onUpdate,
  onRemove,
}: RegionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const set = (field: keyof CustomRegionInput, value: unknown) => {
    onUpdate(regionIdx, { ...region, [field]: value });
  };

  const updateCouncil = useCallback(
    (idx: number, updated: CouncilInput) => {
      const next = [...region.councils];
      next[idx] = updated;
      onUpdate(regionIdx, { ...region, councils: next });
    },
    [region, regionIdx, onUpdate],
  );

  const removeCouncil = useCallback(
    (idx: number) => {
      onUpdate(regionIdx, {
        ...region,
        councils: region.councils.filter((_, i) => i !== idx),
      });
    },
    [region, regionIdx, onUpdate],
  );

  const addCouncil = useCallback(() => {
    onUpdate(regionIdx, {
      ...region,
      councils: [...region.councils, { ...DEFAULT_COUNCIL }],
    });
  }, [region, regionIdx, onUpdate]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <Building2 className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-900">
            {region.name}
          </span>
          {region.code && (
            <span className="text-xs text-gray-400">({region.code})</span>
          )}
        </button>
        <span className="text-xs text-gray-500">
          {region.councils.length} council
          {region.councils.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => onRemove(regionIdx)}
          className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="Remove region"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          {/* Region identity */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={LABEL_CLS}>Name</label>
              <input
                type="text"
                value={region.name}
                onChange={(e) => set('name', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Code</label>
              <input
                type="text"
                value={region.code}
                onChange={(e) =>
                  set(
                    'code',
                    e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
                  )
                }
                placeholder="e.g. SOUTH_EAST"
                className={`${INPUT_CLS} font-mono`}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Description</label>
              <input
                type="text"
                value={region.description ?? ''}
                onChange={(e) => set('description', e.target.value || undefined)}
                placeholder="Optional"
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Default cost templates */}
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Default Cost Templates
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  ['default_capex_bom', 'BOM'],
                  ['default_capex_dno', 'DNO'],
                  ['default_capex_survey', 'Survey'],
                  ['default_capex_council', 'Council'],
                  ['default_opex', 'OPEX'],
                  ['default_revenue_per_site', 'Revenue'],
                ] as const
              ).map(([field, label]) => (
                <div key={field}>
                  <label className={LABEL_CLS}>{label} (&pound;)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={region[field]}
                    onChange={(e) =>
                      set(field, parseFloat(e.target.value) || 0)
                    }
                    className={INPUT_CLS}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Councils */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Councils
              </h4>
              <button
                onClick={addCouncil}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Council
              </button>
            </div>

            {region.councils.length === 0 && (
              <p className="text-xs text-gray-400 italic py-2">
                No councils yet. Click &ldquo;Add Council&rdquo; to get
                started.
              </p>
            )}

            <div className="space-y-2 pl-4 border-l-2 border-gray-100">
              {region.councils.map((council, cIdx) => (
                <CouncilCard
                  key={cIdx}
                  council={council}
                  councilIdx={cIdx}
                  region={region}
                  dnoRegions={dnoRegions}
                  onUpdate={updateCouncil}
                  onRemove={removeCouncil}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function HierarchyEditor({
  hierarchy,
  onChange,
  dnoRegions,
}: HierarchyEditorProps) {
  const updateRegion = useCallback(
    (idx: number, updated: CustomRegionInput) => {
      const next = [...hierarchy];
      next[idx] = updated;
      onChange(next);
    },
    [hierarchy, onChange],
  );

  const removeRegion = useCallback(
    (idx: number) => {
      onChange(hierarchy.filter((_, i) => i !== idx));
    },
    [hierarchy, onChange],
  );

  const addRegion = useCallback(() => {
    onChange([...hierarchy, { ...DEFAULT_REGION, councils: [] }]);
  }, [hierarchy, onChange]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Contract Hierarchy
        </h2>
        <button
          onClick={addRegion}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Custom Region
        </button>
      </div>

      {hierarchy.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <Building2 className="mx-auto h-8 w-8 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            No custom regions yet. Add a region to define your contract
            hierarchy.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {hierarchy.map((region, rIdx) => (
          <RegionCard
            key={rIdx}
            region={region}
            regionIdx={rIdx}
            dnoRegions={dnoRegions}
            onUpdate={updateRegion}
            onRemove={removeRegion}
          />
        ))}
      </div>
    </section>
  );
}
