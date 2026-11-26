import type { SupabaseClient } from "@supabase/supabase-js";

export interface DistributionAssignmentFailure {
  listName: string;
  message: string;
}

/**
 * Ordnet einen importierten Kontakt den Verteilerlisten zu: fehlende Listen
 * werden angelegt, bestehende Mitgliedschaften nicht doppelt eingetragen.
 * Der Import-Hook und der Selbsttest rufen dieselbe Funktion auf.
 */
export async function assignContactToDistributionLists(
  client: SupabaseClient,
  params: { contactId: string; listNames: string[]; userId: string; tenantId: string },
): Promise<DistributionAssignmentFailure[]> {
  const { contactId, listNames, userId, tenantId } = params;
  const failures: DistributionAssignmentFailure[] = [];

  for (const listName of listNames) {
    try {
      const { data: existingList, error: listFetchError } = await client
        .from("distribution_lists")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", listName)
        .maybeSingle();
      if (listFetchError) throw listFetchError;

      let distributionListId = existingList?.id as string | undefined;
      if (!distributionListId) {
        const { data: newList, error: createListError } = await client
          .from("distribution_lists")
          .insert([{ user_id: userId, tenant_id: tenantId, name: listName }])
          .select("id")
          .single();
        if (createListError) throw createListError;
        distributionListId = newList.id;
      }

      const { data: existingMembership, error: membershipFetchError } = await client
        .from("distribution_list_members")
        .select("id")
        .eq("distribution_list_id", distributionListId)
        .eq("contact_id", contactId)
        .maybeSingle();
      if (membershipFetchError) throw membershipFetchError;

      if (!existingMembership) {
        const { error: membershipInsertError } = await client
          .from("distribution_list_members")
          .insert([{ distribution_list_id: distributionListId, contact_id: contactId }]);
        if (membershipInsertError) throw membershipInsertError;
      }
    } catch (error) {
      failures.push({
        listName,
        message: error instanceof Error ? error.message : "Unbekannter Fehler bei Verteilerzuordnung",
      });
    }
  }

  return failures;
}
