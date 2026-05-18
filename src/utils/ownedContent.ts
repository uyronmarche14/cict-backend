import Organization from '../models/Organization';
import { ContentOwnerType } from '../types';

type OwnableRecord = {
  ownerType?: ContentOwnerType | string;
  organizationId?: string | null;
  toObject?: () => Record<string, unknown>;
};

type OwnableWithName<T> = T & {
  organizationName: string | null;
};

const buildOrganizationNameMap = async (organizationIds: string[]) => {
  if (organizationIds.length === 0) {
    return new Map<string, string>();
  }

  const organizations = await Organization.find({ id: { $in: organizationIds } })
    .select('id name')
    .lean();

  return new Map<string, string>(organizations.map((organization) => [organization.id, organization.name]));
};

const toSerializableRecord = <T extends OwnableRecord>(item: T): Record<string, unknown> =>
  typeof item.toObject === 'function' ? item.toObject() : { ...item };

export const attachOrganizationNames = async <T extends OwnableRecord>(
  items: T[]
): Promise<Array<OwnableWithName<Record<string, unknown>>>> => {
  const organizationIds = Array.from(
    new Set(
      items
        .filter(
          (item) =>
            item.ownerType === ContentOwnerType.ORGANIZATION &&
            typeof item.organizationId === 'string' &&
            item.organizationId.trim().length > 0
        )
        .map((item) => item.organizationId!.trim().toLowerCase())
    )
  );

  const organizationNameMap = await buildOrganizationNameMap(organizationIds);

  return items.map((item) => {
    const serializable = toSerializableRecord(item);
    const organizationName =
      item.ownerType === ContentOwnerType.ORGANIZATION && item.organizationId
        ? organizationNameMap.get(item.organizationId) ?? null
        : null;

    return {
      ...serializable,
      organizationName,
    };
  });
};

export const attachOrganizationName = async <T extends OwnableRecord>(
  item: T | null
): Promise<OwnableWithName<Record<string, unknown>> | null> => {
  if (!item) {
    return null;
  }

  const [serialized] = await attachOrganizationNames([item]);
  return serialized ?? null;
};
