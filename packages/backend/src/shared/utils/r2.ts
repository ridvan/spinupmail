export const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  if (chunkSize <= 0) return [items];

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

export const deleteR2ObjectsByPrefix = async ({
  bucket,
  prefix,
}: {
  bucket: R2Bucket;
  prefix: string;
}) => {
  let cursor: string | undefined;
  const keysToDelete: string[] = [];

  do {
    const listed = await bucket.list({
      prefix,
      cursor,
      limit: 1000,
    });
    keysToDelete.push(...listed.objects.map(object => object.key));

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  for (const batch of chunkArray(keysToDelete, 1000)) {
    await bucket.delete(batch);
  }
};

export const getRawEmailR2Key = ({
  organizationId,
  addressId,
  emailId,
}: {
  organizationId: string;
  addressId: string;
  emailId: string;
}) => `email-raw/${organizationId}/${addressId}/${emailId}.eml`;
