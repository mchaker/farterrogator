import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  BlockTitle,
  List,
  ListItem,
  ListInput,
  Toggle,
  Range,
  Segmented,
  SegmentedButton,
} from "konsta/react";
import {
  Shuffle,
  Layers,
  User,
  Palette,
  Cpu,
  Type,
  Shield,
  Globe,
  Server,
  Link2,
  RotateCcw,
  Lock,
  Hourglass,
} from "lucide-react";
import {
  TaggingSettings,
  TagCategory,
  BackendConfig,
  TaggerModelInfo,
} from "../types";

interface ToleranceControlProps {
  settings: TaggingSettings;
  backendConfig: BackendConfig;
  models: TaggerModelInfo[] | null;
  onSettingsChange: (settings: TaggingSettings) => void;
  onBackendChange: (config: BackendConfig) => void;
  disabled?: boolean;
}

export const ToleranceControl: React.FC<ToleranceControlProps> = ({
  settings,
  backendConfig,
  models,
  onSettingsChange,
  onBackendChange,
  disabled,
}) => {
  const { t } = useTranslation();
  const [isAdvanced, setIsAdvanced] = useState(false);

  // Group the server's model list by family, preserving server order
  const modelGroups = useMemo(() => {
    const byFamily = new Map<string, TaggerModelInfo[]>();
    (models ?? []).forEach((m) => {
      const list = byFamily.get(m.family) ?? [];
      list.push(m);
      byFamily.set(m.family, list);
    });
    return [...byFamily.entries()];
  }, [models]);

  const selectedModel = models?.find(
    (m) => m.id === backendConfig.taggerModel,
  );

  const handleModelChange = (id: string) => {
    onBackendChange({ ...backendConfig, taggerModel: id });
    // Re-seed the thresholds from the newly selected model's defaults
    const info = models?.find((m) => m.id === id);
    if (info) {
      onSettingsChange({
        ...settings,
        thresholds: {
          ...settings.thresholds,
          general: info.default_threshold,
          character: info.default_character_threshold,
        },
      });
    }
  };

  const updateThreshold = (category: TagCategory, value: number) => {
    onSettingsChange({
      ...settings,
      thresholds: { ...settings.thresholds, [category]: value },
    });
  };

  const updateOverallThreshold = (value: number) => {
    onSettingsChange({
      ...settings,
      thresholds: {
        general: value,
        character: value,
        copyright: value,
        artist: value,
        meta: value,
        rating: 0.8,
      },
    });
  };

  const categories: {
    id: TagCategory;
    label: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      id: "copyright",
      label: t("settings.categories.copyright"),
      icon: <Globe className="w-4 h-4" aria-hidden="true" />,
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      id: "character",
      label: t("settings.categories.character"),
      icon: <User className="w-4 h-4" aria-hidden="true" />,
      color: "text-green-600 dark:text-green-400",
    },
    {
      id: "artist",
      label: t("settings.categories.artist"),
      icon: <Palette className="w-4 h-4" aria-hidden="true" />,
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      id: "general",
      label: t("settings.categories.general"),
      icon: <Layers className="w-4 h-4" aria-hidden="true" />,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      id: "meta",
      label: t("settings.categories.meta"),
      icon: <Cpu className="w-4 h-4" aria-hidden="true" />,
      color: "text-slate-600 dark:text-slate-400",
    },
    {
      id: "rating",
      label: t("settings.categories.rating"),
      icon: <Shield className="w-4 h-4" aria-hidden="true" />,
      color: "text-rose-600 dark:text-rose-400",
    },
  ];

  const sliderRow = (
    label: React.ReactNode,
    value: number,
    display: string,
    onInput: (v: number) => void,
    min: number,
    max: number,
    step: number,
  ) => (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        {label}
        <span className="font-mono text-xs text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant">
          {display}
        </span>
      </div>
      <Range
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onInput={(e: React.ChangeEvent<HTMLInputElement>) =>
          onInput(parseFloat(e.target.value))
        }
      />
    </div>
  );

  return (
    <div>
      {/* Model & endpoint */}
      <BlockTitle className="mt-0! mb-2!">
        {t("settings.backend.model")}
      </BlockTitle>
      <List strong inset className="my-0!">
        <ListInput
          label={t("settings.backend.model")}
          type="select"
          dropdown
          media={<Server className="w-5 h-5" aria-hidden="true" />}
          value={backendConfig.taggerModel}
          disabled={disabled}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            handleModelChange(e.target.value)
          }
        >
          {models ? (
            modelGroups.map(([family, familyModels]) => (
              <optgroup
                key={family}
                label={t(`settings.backend.families.${family}`, {
                  defaultValue: family,
                })}
              >
                {familyModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.recommended ? "★ " : ""}
                    {m.label} —{" "}
                    {t(`settings.backend.models.${m.id}`, {
                      defaultValue: m.description,
                    })}
                    {m.gated ? " 🔒" : ""}
                  </option>
                ))}
              </optgroup>
            ))
          ) : (
            // Model list not loaded (yet); keep the saved selection usable
            <option value={backendConfig.taggerModel}>
              {backendConfig.taggerModel}
            </option>
          )}
        </ListInput>
        <ListInput
          label={t("settings.backend.baseUrl")}
          type="url"
          media={<Link2 className="w-5 h-5" aria-hidden="true" />}
          value={backendConfig.taggerBaseUrl}
          placeholder="https://localtagger.gpu.garden"
          disabled={disabled}
          inputClassName="font-mono text-xs"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onBackendChange({ ...backendConfig, taggerBaseUrl: e.target.value })
          }
        />
      </List>
      {selectedModel?.gated && (
        <p className="flex items-center gap-1.5 px-4 pt-1.5 text-xs text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant">
          <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
          {t("settings.backend.gatedHint")}
        </p>
      )}
      {selectedModel && !selectedModel.loaded && (
        <p className="flex items-center gap-1.5 px-4 pt-1.5 text-xs text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant">
          <Hourglass className="w-3 h-3 shrink-0" aria-hidden="true" />
          {t("settings.backend.warmupHint")}
        </p>
      )}
      <div className="flex justify-end px-4 pt-1">
        <button
          type="button"
          onClick={() =>
            onBackendChange({
              ...backendConfig,
              taggerBaseUrl: "https://localtagger.gpu.garden",
            })
          }
          disabled={
            disabled ||
            backendConfig.taggerBaseUrl === "https://localtagger.gpu.garden"
          }
          className="flex items-center gap-1 text-xs text-primary dark:text-md-dark-primary hover:underline disabled:opacity-30 disabled:no-underline disabled:cursor-default transition-opacity"
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
          {t("settings.backend.resetToDefault")}
        </button>
      </div>

      {/* Output */}
      <BlockTitle className="mt-6! mb-2!">
        {t("settings.outputSettings")}
      </BlockTitle>
      <List strong inset className="my-0!">
        <ListItem
          innerChildren={sliderRow(
            <span>{t("settings.topK")}</span>,
            settings.topK,
            String(settings.topK),
            (v) => onSettingsChange({ ...settings, topK: v }),
            10,
            100,
            5,
          )}
        />
        <ListItem
          innerChildren={sliderRow(
            <span>{t("settings.maxTags")}</span>,
            settings.maxTags || 0,
            String(settings.maxTags || 0),
            (v) => onSettingsChange({ ...settings, maxTags: v }),
            0,
            100,
            5,
          )}
        />
        <ListInput
          label={t("settings.whitelist")}
          type="text"
          value={settings.whitelist || ""}
          placeholder={t("settings.whitelistPlaceholder")}
          disabled={disabled}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onSettingsChange({ ...settings, whitelist: e.target.value })
          }
        />
        <ListInput
          label={t("settings.blacklist")}
          type="text"
          value={settings.blacklist || ""}
          placeholder={t("settings.blacklistPlaceholder")}
          disabled={disabled}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onSettingsChange({ ...settings, blacklist: e.target.value })
          }
        />
        <ListItem
          label
          title={t("settings.randomize")}
          media={
            <Shuffle
              className={`w-5 h-5 ${settings.randomize ? "text-primary dark:text-md-dark-primary" : "opacity-50"}`}
              aria-hidden="true"
            />
          }
          after={
            <Toggle
              checked={settings.randomize}
              disabled={disabled}
              onChange={() =>
                onSettingsChange({
                  ...settings,
                  randomize: !settings.randomize,
                })
              }
            />
          }
        />
        <ListItem
          label
          title={t("settings.removeUnderscores")}
          media={
            <Type
              className={`w-5 h-5 ${settings.removeUnderscores ? "text-primary dark:text-md-dark-primary" : "opacity-50"}`}
              aria-hidden="true"
            />
          }
          after={
            <Toggle
              checked={settings.removeUnderscores}
              disabled={disabled}
              onChange={() =>
                onSettingsChange({
                  ...settings,
                  removeUnderscores: !settings.removeUnderscores,
                })
              }
            />
          }
        />
      </List>

      {/* Thresholds */}
      <BlockTitle className="mt-6! mb-2!">
        {t("settings.thresholds")}
      </BlockTitle>
      <div className="px-4 pb-2">
        <Segmented strong rounded>
          <SegmentedButton
            active={!isAdvanced}
            onClick={() => setIsAdvanced(false)}
          >
            {t("settings.simpleMode")}
          </SegmentedButton>
          <SegmentedButton
            active={isAdvanced}
            onClick={() => setIsAdvanced(true)}
          >
            {t("settings.advancedThresholds")}
          </SegmentedButton>
        </Segmented>
      </div>
      <List strong inset className="my-0!">
        {!isAdvanced ? (
          <ListItem
            innerChildren={sliderRow(
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4" aria-hidden="true" />
                {t("settings.categories.general")}
              </span>,
              settings.thresholds.general,
              settings.thresholds.general.toFixed(2),
              updateOverallThreshold,
              0,
              0.95,
              0.05,
            )}
          />
        ) : (
          categories.map((cat) => (
            <ListItem
              key={cat.id}
              innerChildren={sliderRow(
                <span
                  className={`flex items-center gap-1.5 font-medium ${cat.color}`}
                >
                  {cat.icon}
                  {cat.label}
                </span>,
                settings.thresholds[cat.id],
                settings.thresholds[cat.id].toFixed(2),
                (v) => updateThreshold(cat.id, v),
                0,
                0.95,
                0.05,
              )}
            />
          ))
        )}
      </List>
    </div>
  );
};
