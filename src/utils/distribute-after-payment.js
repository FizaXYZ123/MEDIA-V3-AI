module.exports = {

  async fullDistribute(draftId) {
    console.log("🚀 START DISTRIBUTION");

    // =========================
    // 1. FETCH DRAFT
    // =========================
    const draft = await strapi.db.query('api::distribute-draft.distribute-draft').findOne({
      where: { id: draftId },
      populate: {
        CoverArt: true,
        UserDetail: true,
        TrackList: {
          populate: {
            artistDetails: true,
          },
        },
      },
    });

    if (!draft) {
      throw new Error("Draft not found");
    }

    // =========================
    // 2. FINISH (GENERATE ISRC)
    // =========================
    let generatedISRCs = [];

    if (Array.isArray(draft?.TrackList)) {
      for (const track of draft.TrackList) {

        if (track.ISRC) {
          generatedISRCs.push(track.ISRC);
          continue;
        }

        if (track.RequestANewISRC || draft.RequestANewReferenceNumber) {
          const prefix = "CB-H6V";
          const year = new Date().getFullYear().toString().slice(-2);

          const lastTrack = await strapi.entityService.findMany(
            "api::distribute-track.distribute-track",
            {
              filters: {
                ISRC: { $startsWith: `${prefix}-${year}-` },
              },
              sort: { createdAt: "desc" },
              limit: 1,
            }
          );

          let serial = 1;

          if (lastTrack.length && lastTrack[0].ISRC) {
            const lastNumber = parseInt(
              lastTrack[0].ISRC.split("-").pop(),
              10
            );
            if (!isNaN(lastNumber)) serial = lastNumber + 1;
          }

          const isrc = `${prefix}-${year}-${String(serial).padStart(5, "0")}`;

          await strapi.entityService.update(
            "api::distribute-track.distribute-track",
            track.id,
            { data: { ISRC: isrc } }
          );

          generatedISRCs.push(isrc);
        }
      }
    }

    // update draft (finish step)
    await strapi.entityService.update(
      "api::distribute-draft.distribute-draft",
      draftId,
      {
        data: {
          publishedAt: new Date(),
          CompletedSteps: "done",
          ...(generatedISRCs.length && { ISRC_CODES: generatedISRCs }),
        },
      }
    );

    console.log("✅ FINISH COMPLETED");

    // =========================
    // 3. CREATE PUBLISH
    // =========================
    const publishData = {
  ReleaseTitle: draft.ReleaseTitle,
  ReleaseType: draft.ReleaseType,
  Version: draft.Version,
  LanguageOfTheTitles: draft.LanguageOfTheTitles,
  PrimaryGenre: draft.PrimaryGenre,
  SecondaryGenre: draft.SecondaryGenre,
  AddLabel: draft.AddLabel,
  ReferenceNumber: draft.ReferenceNumber,
  Priority: draft.Priority,
  TimeZoneOfReference: draft.TimeZoneOfReference,
  Countries: draft.Countries,
  MusicStores: draft.MusicStores,
  ReleaseTime: draft.ReleaseTime,
  OriginalReleaseDate: draft.OriginalReleaseDate,
  DigitalReleaseDate: draft.DigitalReleaseDate,
  CopyrightholderName: draft.CopyrightholderName,
  CopyrightYear: draft.CopyrightYear,
  PhonogramRightsHolderName: draft.PhonogramRightsHolderName,
  PhonogramRightsHolderYear: draft.PhonogramRightsHolderYear,
  PriceCategory: draft.PriceCategory,
  CoverArt: draft.CoverArt?.id || null,
};

    const newPublish = await strapi.db
      .query('api::publish-distribute.publish-distribute')
      .create({
        data: {
          ...publishData,
          publishedAt: new Date(),
          UserDetail: draft.UserDetail?.id,
        },
      });

    // console.log("✅ PUBLISH CREATED:", newPublish.id);

    // =========================
    // 4. UPDATE TRACKS + ARTISTS
    // =========================
    for (const track of draft.TrackList || []) {

      await strapi.db.query('api::distribute-track.distribute-track').update({
        where: { id: track.id },
        data: {
          publishedAt: new Date(),
          PublishedRelease: newPublish.id,
        },
      });

      if (Array.isArray(track.artistDetails)) {
        for (const artist of track.artistDetails) {
          await strapi.db.query('api::artist-detail.artist-detail').update({
            where: { id: artist.id },
            data: { publishedAt: new Date() },
          });
        }
      } else if (track.artistDetails) {
        await strapi.db.query('api::artist-detail.artist-detail').update({
          where: { id: track.artistDetails.id },
          data: { publishedAt: new Date() },
        });
      }
    }

    // console.log("✅ TRACKS + ARTISTS PUBLISHED");

    // =========================
    // 5. DELETE DRAFT
    // =========================
    await strapi.db.query('api::distribute-draft.distribute-draft').delete({
      where: { id: draftId },
    });

    // console.log("🗑️ DRAFT DELETED");

    console.log("🎉 DISTRIBUTION DONE");

    return newPublish;
  }

};