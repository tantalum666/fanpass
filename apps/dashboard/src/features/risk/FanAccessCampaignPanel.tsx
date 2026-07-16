import { useState, type FormEvent } from "react";
import {
  ConsoleApiError,
  saveFanCampaign,
  type SaveFanCampaignInput,
} from "../../console/api";
import { formatDateTime, titleCase } from "../../console/format";
import type {
  AlphaEvent,
  FanCampaign,
  FanCampaignTask,
} from "../../console/types";
import {
  Badge,
  EmptyState,
  Section,
  toneForStatus,
} from "../../components/ConsoleUi";

type CampaignTaskDraft = SaveFanCampaignInput["tasks"][number];

interface CampaignDraft extends Omit<
  SaveFanCampaignInput,
  "startsAt" | "closesAt"
> {
  startsAt: string;
  closesAt: string;
}

const TASK_TEMPLATES: Record<
  FanCampaignTask["taskType"],
  Omit<CampaignTaskDraft, "id">
> = {
  FOLLOW: {
    title: "Follow the artist",
    description: "Follow the verified artist profile on FanPass.",
    taskType: "FOLLOW",
    points: 5,
    verificationMethod: "MANUAL",
    verificationLabel: "Reviewed by the organizer",
    actionKind: "FOLLOW_ARTIST",
    optional: false,
  },
  TICKET_HOLD: {
    title: "Hold a verified ticket",
    description: "Own an active FanPass ticket for this event.",
    taskType: "TICKET_HOLD",
    points: 35,
    verificationMethod: "AUTO",
    verificationLabel: "Verified from FanPass ticket ownership",
    actionKind: "VIEW_TICKETS",
    optional: false,
  },
  CHECK_IN: {
    title: "Attend live",
    description: "Check in with a valid FanPass ticket at the venue.",
    taskType: "CHECK_IN",
    points: 30,
    verificationMethod: "AUTO",
    verificationLabel: "Verified at venue check-in",
    actionKind: "VIEW_TICKETS",
    optional: true,
  },
  PURCHASE_HISTORY: {
    title: "Complete a verified purchase",
    description: "Complete a settled ticket purchase for this event.",
    taskType: "PURCHASE_HISTORY",
    points: 25,
    verificationMethod: "AUTO",
    verificationLabel: "Verified from settled FanPass orders",
    actionKind: "VIEW_TICKETS",
    optional: true,
  },
  QUIZ: {
    title: "Answer the fan quiz",
    description: "Submit the campaign quiz for organizer review.",
    taskType: "QUIZ",
    points: 5,
    verificationMethod: "MANUAL",
    verificationLabel: "Reviewed by the organizer",
    actionKind: "OPEN_QUIZ",
    optional: true,
  },
  SHARE: {
    title: "Share the campaign",
    description: "Submit a campaign share for organizer review.",
    taskType: "SHARE",
    points: 5,
    verificationMethod: "MANUAL",
    verificationLabel: "Reviewed by the organizer",
    actionKind: "SHARE_CAMPAIGN",
    optional: true,
  },
  MANUAL: {
    title: "Community contribution",
    description: "Submit a meaningful contribution for organizer review.",
    taskType: "MANUAL",
    points: 10,
    verificationMethod: "MANUAL",
    verificationLabel: "Reviewed by the organizer",
    actionKind: "SUBMIT_PROOF",
    optional: true,
  },
};

export function FanAccessCampaignPanel({
  event,
  campaign,
  onRefresh,
}: {
  event: AlphaEvent;
  campaign: FanCampaign | null;
  onRefresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(campaign === null);

  return (
    <Section
      action={
        campaign && !editing ? (
          <button
            className="secondary-button"
            onClick={() => setEditing(true)}
            type="button"
          >
            Edit campaign
          </button>
        ) : null
      }
      description="Define a transparent qualification contract. Wallet count never multiplies points or claims."
      title="Fan Access campaign"
    >
      {editing ? (
        <CampaignEditor
          campaign={campaign}
          event={event}
          onCancel={campaign ? () => setEditing(false) : undefined}
          onSaved={async () => {
            await onRefresh();
            setEditing(false);
          }}
        />
      ) : campaign ? (
        <CampaignSummary campaign={campaign} />
      ) : (
        <EmptyState
          description="Create one clear reward with one to three meaningful tasks."
          title="No Fan Access campaign"
        />
      )}
    </Section>
  );
}

function CampaignSummary({ campaign }: { campaign: FanCampaign }) {
  return (
    <div className="fan-campaign-summary">
      <div className="fan-campaign-contract">
        <div>
          <Badge tone={toneForStatus(campaign.status)}>
            {titleCase(campaign.status)}
          </Badge>
          <h3>{campaign.rewardTitle}</h3>
          <p>{campaign.rewardDescription}</p>
        </div>
        <dl>
          <div>
            <dt>Supply</dt>
            <dd>{campaign.rewardSupply.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Qualify</dt>
            <dd>{campaign.qualificationPoints} pts</dd>
          </div>
          <div>
            <dt>Allocation</dt>
            <dd>{titleCase(campaign.allocationMethod)}</dd>
          </div>
          <div>
            <dt>Closes</dt>
            <dd>{formatDateTime(campaign.closesAt)}</dd>
          </div>
        </dl>
      </div>
      <div className="fan-task-contract-list">
        {campaign.tasks.map((task, index) => (
          <article className="fan-task-contract" key={task.id}>
            <span>{index + 1}</span>
            <div>
              <strong>{task.title}</strong>
              <p>{task.description}</p>
              <small>{task.verificationLabel}</small>
            </div>
            <div>
              <strong>+{task.points}</strong>
              <Badge tone={task.optional ? "neutral" : "info"}>
                {task.optional ? "Optional" : "Core"}
              </Badge>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function CampaignEditor({
  event,
  campaign,
  onCancel,
  onSaved,
}: {
  event: AlphaEvent;
  campaign: FanCampaign | null;
  onCancel?: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => campaignDraft(event, campaign));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateTask(index: number, patch: Partial<CampaignTaskDraft>) {
    setDraft((current) => ({
      ...current,
      tasks: current.tasks.map((task, taskIndex) =>
        taskIndex === index ? { ...task, ...patch } : task,
      ),
    }));
  }

  function changeTaskType(
    index: number,
    taskType: FanCampaignTask["taskType"],
  ) {
    const currentId = draft.tasks[index]?.id;
    updateTask(index, {
      ...TASK_TEMPLATES[taskType],
      ...(currentId ? { id: currentId } : {}),
    });
  }

  async function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveFanCampaign(event.id, {
        ...draft,
        startsAt: new Date(draft.startsAt).toISOString(),
        closesAt: new Date(draft.closesAt).toISOString(),
      });
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof ConsoleApiError
          ? caught.message
          : "Fan Access campaign could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  const availablePoints = draft.tasks.reduce(
    (total, task) => total + task.points,
    0,
  );

  return (
    <form className="fan-campaign-editor" onSubmit={submit}>
      <div className="form-columns">
        <label>
          Campaign title
          <input
            maxLength={120}
            onChange={(input) =>
              setDraft({ ...draft, title: input.target.value })
            }
            required
            value={draft.title}
          />
        </label>
        <label>
          Reward name
          <input
            maxLength={120}
            onChange={(input) =>
              setDraft({ ...draft, rewardTitle: input.target.value })
            }
            required
            value={draft.rewardTitle}
          />
        </label>
      </div>
      <div className="form-columns">
        <label>
          Campaign description
          <textarea
            maxLength={280}
            onChange={(input) =>
              setDraft({ ...draft, description: input.target.value })
            }
            required
            rows={3}
            value={draft.description}
          />
        </label>
        <label>
          Reward description
          <textarea
            maxLength={280}
            onChange={(input) =>
              setDraft({ ...draft, rewardDescription: input.target.value })
            }
            required
            rows={3}
            value={draft.rewardDescription}
          />
        </label>
      </div>
      <div className="fan-campaign-settings">
        <label>
          Reward supply
          <input
            max={1_000_000}
            min={1}
            onChange={(input) =>
              setDraft({ ...draft, rewardSupply: Number(input.target.value) })
            }
            required
            type="number"
            value={draft.rewardSupply}
          />
        </label>
        <label>
          Points to qualify
          <input
            max={100}
            min={1}
            onChange={(input) =>
              setDraft({
                ...draft,
                qualificationPoints: Number(input.target.value),
              })
            }
            required
            type="number"
            value={draft.qualificationPoints}
          />
          <small>{availablePoints} points available</small>
        </label>
        <label>
          Allocation
          <select
            onChange={(input) =>
              setDraft({
                ...draft,
                allocationMethod: input.target
                  .value as SaveFanCampaignInput["allocationMethod"],
              })
            }
            value={draft.allocationMethod}
          >
            <option value="EQUAL_DRAW">Equal draw</option>
            <option value="GUARANTEED">Guaranteed</option>
          </select>
        </label>
        <label>
          Status
          <select
            onChange={(input) =>
              setDraft({
                ...draft,
                status: input.target.value as SaveFanCampaignInput["status"],
              })
            }
            value={draft.status}
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
          </select>
        </label>
      </div>
      <div className="form-columns">
        <label>
          Starts
          <input
            onChange={(input) =>
              setDraft({ ...draft, startsAt: input.target.value })
            }
            required
            type="datetime-local"
            value={draft.startsAt}
          />
        </label>
        <label>
          Closes
          <input
            onChange={(input) =>
              setDraft({ ...draft, closesAt: input.target.value })
            }
            required
            type="datetime-local"
            value={draft.closesAt}
          />
        </label>
      </div>

      <div className="fan-task-editor-heading">
        <div>
          <strong>Qualification tasks</strong>
          <p>Keep the campaign to three meaningful actions or fewer.</p>
        </div>
        <button
          className="secondary-button"
          disabled={draft.tasks.length >= 3}
          onClick={() =>
            setDraft({
              ...draft,
              tasks: [...draft.tasks, { ...TASK_TEMPLATES.CHECK_IN }],
            })
          }
          type="button"
        >
          Add task
        </button>
      </div>
      <div className="fan-task-editors">
        {draft.tasks.map((task, index) => (
          <fieldset className="fan-task-editor" key={task.id ?? index}>
            <legend>Task {index + 1}</legend>
            <div className="fan-task-editor-toolbar">
              <label>
                Task type
                <select
                  onChange={(input) =>
                    changeTaskType(
                      index,
                      input.target.value as FanCampaignTask["taskType"],
                    )
                  }
                  value={task.taskType}
                >
                  {Object.keys(TASK_TEMPLATES).map((taskType) => (
                    <option key={taskType} value={taskType}>
                      {titleCase(taskType)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Points
                <input
                  max={100}
                  min={1}
                  onChange={(input) =>
                    updateTask(index, { points: Number(input.target.value) })
                  }
                  required
                  type="number"
                  value={task.points}
                />
              </label>
              <label className="checkbox-field fan-task-optional">
                <input
                  checked={task.optional}
                  onChange={(input) =>
                    updateTask(index, { optional: input.target.checked })
                  }
                  type="checkbox"
                />
                Optional
              </label>
              <button
                className="danger-text"
                disabled={draft.tasks.length === 1}
                onClick={() =>
                  setDraft({
                    ...draft,
                    tasks: draft.tasks.filter(
                      (_candidate, taskIndex) => taskIndex !== index,
                    ),
                  })
                }
                type="button"
              >
                Remove
              </button>
            </div>
            <div className="form-columns">
              <label>
                Task title
                <input
                  maxLength={120}
                  onChange={(input) =>
                    updateTask(index, { title: input.target.value })
                  }
                  required
                  value={task.title}
                />
              </label>
              <label>
                Verification label
                <input
                  maxLength={120}
                  onChange={(input) =>
                    updateTask(index, {
                      verificationLabel: input.target.value,
                    })
                  }
                  required
                  value={task.verificationLabel}
                />
              </label>
            </div>
            <label>
              Description
              <input
                maxLength={240}
                onChange={(input) =>
                  updateTask(index, { description: input.target.value })
                }
                required
                value={task.description}
              />
            </label>
          </fieldset>
        ))}
      </div>
      {error ? (
        <p className="form-message form-message--error">{error}</p>
      ) : null}
      <div className="fan-campaign-actions">
        {onCancel ? (
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
        <button disabled={saving} type="submit">
          {saving ? "Saving…" : "Save campaign"}
        </button>
      </div>
    </form>
  );
}

function campaignDraft(
  event: AlphaEvent,
  campaign: FanCampaign | null,
): CampaignDraft {
  if (campaign) {
    return {
      title: campaign.title,
      description: campaign.description,
      rewardTitle: campaign.rewardTitle,
      rewardDescription: campaign.rewardDescription,
      rewardSupply: campaign.rewardSupply,
      qualificationPoints: campaign.qualificationPoints,
      allocationMethod: campaign.allocationMethod,
      status: campaign.status === "DRAFT" ? "DRAFT" : "ACTIVE",
      startsAt: dateTimeLocal(campaign.startsAt),
      closesAt: dateTimeLocal(campaign.closesAt),
      tasks: campaign.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        taskType: task.taskType,
        points: task.points,
        verificationMethod: task.verificationMethod,
        verificationLabel: task.verificationLabel,
        actionKind: task.actionKind,
        optional: task.optional,
      })),
    };
  }

  const now = new Date();
  const eventStart = new Date(event.startTime);
  const defaultClose = new Date(
    Math.max(now.getTime() + 7 * 86_400_000, eventStart.getTime() - 86_400_000),
  );
  return {
    title: `${event.title} Fan Access`,
    description:
      "Qualify through a small set of meaningful, verifiable fan actions.",
    rewardTitle: `${event.title} Priority Access`,
    rewardDescription:
      "Eligible fans enter a fair allocation for priority ticket access.",
    rewardSupply: 240,
    qualificationPoints: 40,
    allocationMethod: "EQUAL_DRAW",
    status: "DRAFT",
    startsAt: dateTimeLocal(now.toISOString()),
    closesAt: dateTimeLocal(defaultClose.toISOString()),
    tasks: [
      { ...TASK_TEMPLATES.FOLLOW },
      { ...TASK_TEMPLATES.TICKET_HOLD },
      { ...TASK_TEMPLATES.CHECK_IN },
    ],
  };
}

function dateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
