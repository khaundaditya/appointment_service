import { Injectable } from '@nestjs/common';
import { orderBy } from 'lodash';
import { CutterSlotsDto } from './dto/cutter-slots.dto';

@Injectable()
export class CustomerJourneyUtility {
  async calculateRecommendedCutters1(
    userwise_cutters: any,
    cutterSlotsDto: CutterSlotsDto,
    is_from_edit: number,
  ) {
    try {
      const assignedCutters = {};
      let assingedSlots = [];
      let message_type = '';
      let count = 0;
      const tmp_obj = JSON.parse(JSON.stringify(userwise_cutters));
      tmp_obj.sort((a, b) => +b.duration - +a.duration);

      for (const obj of tmp_obj) {
        obj.cutters = orderBy(
          obj.cutters,
          ['first_start_time', 'rating'],
          ['asc', 'desc'],
        );

        assingedSlots = orderBy(assingedSlots, ['time_to'], ['asc']);

        if (obj.cutters.length === 1) {
          const cobj = obj.cutters[0];
          if (assingedSlots.length) {
            for (const slot of assingedSlots) {
              const foundIndex = cobj.cutter_availability.findIndex(
                (ca) => ca.time_from === slot.time_to,
              );

              if (foundIndex !== -1) {
                const slotToInset = this.createSlotToInsert(cobj, foundIndex);
                if (is_from_edit === 0) {
                  cobj.cutter_availability[foundIndex]['is_recommended'] = 1;
                }
                obj.recommendedCutter.push(cobj);
                assignedCutters[cobj.employee_user_id] = [slotToInset];
                assingedSlots.push(slotToInset);
                break;
              }
            }
          } else {
            // assign first cutter if its first iteration of code
            const slotToInset = this.createSlotToInsert(cobj);
            if (is_from_edit === 0) {
              cobj.cutter_availability[0]['is_recommended'] = 1;
            }
            obj.recommendedCutter.push(cobj);
            assignedCutters[cobj.employee_user_id] = [slotToInset];
            assingedSlots.push(slotToInset);
            // break;
          }
        } else {
          for (let i = 0; i < obj.cutters.length; i++) {
            // const cobj = JSON.parse(JSON.stringify(obj.cutters[i]));
            const cobj = obj.cutters[i];

            if (assingedSlots.length) {
              // if id is already in recommend then check next cutter
              if (assignedCutters[cobj.employee_user_id]) {
                continue;
              } else {
                const slotToInset = this.createSlotToInsert(cobj);

                // check new slot is in overlaping or not
                const isOverlap = assingedSlots.find(
                  (ca) =>
                    ((new Date(slotToInset.time_from) >=
                      new Date(ca.time_from) &&
                      new Date(slotToInset.time_to) <= new Date(ca.time_to)) ||
                      (new Date(slotToInset.time_from) >=
                        new Date(ca.time_from) &&
                        new Date(slotToInset.time_from) <=
                          new Date(ca.time_to))) &&
                    ca.cutter_id !== slotToInset.cutter_id,
                );

                if (isOverlap) {
                  // push cutters first slot in recommend
                  if (is_from_edit === 0) {
                    cobj.cutter_availability[0]['is_recommended'] = 1;
                  }
                  obj.recommendedCutter.push(cobj);
                  assignedCutters[cobj.employee_user_id] = [slotToInset];
                  assingedSlots.push(slotToInset);
                  break;
                }

                // reverse checking (Iteration 2)
                if (i === obj.cutters.length - 1) {
                  // let tmpRecommend;
                  // temporary assign slot by checking continuation
                  const continueSlot = assingedSlots.find(
                    (ca) => ca.time_to === slotToInset.time_from,
                  );

                  if (continueSlot) {
                    // tmpRecommend = cobj;
                    // cobj.cutter_availability[0]['is_recommended'] = 1;
                    obj.recommendedCutter = [cobj];
                  }
                  let finalAssingedSlot;

                  assingedSlots = orderBy(assingedSlots, ['time_to'], ['desc']);

                  for (let j = i; j >= 0; j--) {
                    // check for previous cutter
                    const tmpcObj = obj.cutters[j];
                    let tmpSlotToInset = this.createSlotToInsert(tmpcObj);

                    for (const slot of assingedSlots) {
                      // let cutterIdCheck = tmpcObj.employee_user_id !== slot.cutter_id;

                      // check for cutter id same and overlapping in already assigned slots
                      const foundIndex = tmpcObj.cutter_availability.findIndex(
                        (ca) => ca.time_from === slot.time_to,
                      );

                      if (foundIndex !== -1) {
                        // tmpcObj.cutter_availability[foundIndex]['is_recommended'] = 1;
                        tmpSlotToInset = this.createSlotToInsert(
                          tmpcObj,
                          foundIndex,
                        );
                      }
                    }
                    const tmpContinueSlot = assingedSlots.find(
                      (ca) => ca.time_to === tmpSlotToInset.time_from,
                    );

                    if (tmpContinueSlot) {
                      // tmpRecommend = tmpcObj;
                      // cobj.cutter_availability[0]['is_recommended'] = 1;
                      obj.recommendedCutter = [tmpcObj];
                      // cobj.cutter_availability[0]['is_recommended'] = 1;
                      finalAssingedSlot = tmpSlotToInset;
                    }
                  }

                  // here asisgne finalAssiedSLot in assignedslots array
                  if (finalAssingedSlot?.cutter_id) {
                    const foundExistingCutter = obj.cutters.find(
                      (ca) =>
                        ca.employee_user_id === finalAssingedSlot.cutter_id,
                    );

                    if (foundExistingCutter) {
                      const foundSLot =
                        foundExistingCutter.cutter_availability.find(
                          (slot) =>
                            slot.time_from === finalAssingedSlot.time_from,
                        );

                      if (foundSLot && is_from_edit === 0) {
                        foundSLot['is_recommended'] = 1;
                      }
                    }
                  }
                  assingedSlots.push(finalAssingedSlot);
                }
              }
            } else {
              // assign first cutter if its first iteration of code
              const slotToInset = this.createSlotToInsert(cobj);

              if (is_from_edit === 0) {
                cobj.cutter_availability[0]['is_recommended'] = 1;
              }
              obj.recommendedCutter.push(cobj);
              assignedCutters[cobj.employee_user_id] = [slotToInset];
              assingedSlots.push(slotToInset);
              break;
            }
          }
        }

        if (obj.recommendedCutter && obj.recommendedCutter.length) {
          // remove actual cutter from cutters array
          for (const recommendCutter of obj.recommendedCutter) {
            const removeCutterIndex = obj.cutters.findIndex(
              (ca) => ca.employee_user_id === recommendCutter.employee_user_id,
            );

            if (removeCutterIndex !== -1) {
              obj.cutters.splice(removeCutterIndex, 1);
            }
          }
        } else {
          obj.cutters = [];
          message_type = 'ONLY_BOOK_FOR_YOU';
          count += 1;
          //  NOT FOR ALL - in case no cutters available for any user
        }

        obj.cutters_mobile = [...obj.recommendedCutter, ...obj.cutters];
      }

      if (count === userwise_cutters.length) {
        message_type = 'NO_SLOTS_FOUND';
      }

      tmp_obj.sort((a, b) => +a.counter - +b.counter);

      if (cutterSlotsDto.recommended_cutter_id) {
        for (const obj of tmp_obj) {
          // Note: For web cutters
          const checkRecommendedCutter = obj.recommendedCutter.find(
            (rc) =>
              rc.employee_user_id === cutterSlotsDto.recommended_cutter_id,
          );
          if (!checkRecommendedCutter) {
            const foundRecommendedCutter = obj.cutters.find(
              (c) =>
                c.employee_user_id === cutterSlotsDto.recommended_cutter_id,
            );
            if (foundRecommendedCutter) {
              for (const rcObj of obj.recommendedCutter) {
                obj.cutters.push(rcObj);
              }
              obj.recommendedCutter = [foundRecommendedCutter];

              obj.cutters.splice(foundRecommendedCutter, 1);
            }
          }

          // Note: For mobile cutters
          const foundRecommendedCutterMobileIndex =
            obj.cutters_mobile.findIndex(
              (c) =>
                c.employee_user_id === cutterSlotsDto.recommended_cutter_id,
            );
          if (foundRecommendedCutterMobileIndex !== -1) {
            const foundRecommendedCutterMobile =
              obj.cutters_mobile[foundRecommendedCutterMobileIndex];
            obj.cutters_mobile.splice(foundRecommendedCutterMobileIndex, 1);
            obj.cutters_mobile.unshift(foundRecommendedCutterMobile);
          }
        }
      }

      return { userwise_cutters: tmp_obj, message_type };
    } catch (err) {
      throw err;
    }
  }

  createSlotToInsert(cobj, index = 0) {
    return {
      time_from: cobj.cutter_availability[index].time_from,
      time_to: cobj.cutter_availability[index].time_to,
      cutter_id: cobj.employee_user_id,
    };
  }

  getBookedDuration(
    guest_user_id: string,
    customer_id: string,
    guest_id: string,
    bookedSlots: any,
    bookedSlot: any,
  ) {
    let totalDuration = 0;
    if (
      (bookedSlot.customer_id || bookedSlot.guest_user_id) &&
      !bookedSlot.guest_id
    ) {
      const customerBookedSlots = bookedSlots.filter(
        (obj) =>
          (obj.customer_id === customer_id ||
            obj.guest_user_id === guest_user_id) &&
          !obj.guest_id &&
          obj.time_from &&
          obj.time_to &&
          obj.db_booked_slot === 0,
      );

      for (const cbs of customerBookedSlots) {
        totalDuration += +cbs.approx_time;
        if (+cbs.service_option_duration) {
          totalDuration += +cbs.service_option_duration;
        }
      }
    }

    if (
      (bookedSlot.customer_id || bookedSlot.guest_user_id) &&
      bookedSlot.guest_id
    ) {
      const customerBookedSlots = bookedSlots.filter(
        (obj) =>
          (obj.customer_id === customer_id ||
            obj.guest_user_id === guest_user_id) &&
          obj.guest_id === guest_id &&
          obj.time_from &&
          obj.time_to &&
          obj.db_booked_slot === 0,
      );

      for (const cbs of customerBookedSlots) {
        totalDuration += +cbs.approx_time;
        if (+cbs.service_option_duration) {
          totalDuration += +cbs.service_option_duration;
        }
      }
    }

    return totalDuration;
  }

  cutterSlotQuery(store_id: string, startDate: string, endDate: string) {
    return `
      with emp_data AS ( SELECT DISTINCT on (employee_user_id, shift_start_time, shift_type)
        primary_contact,
        bio,
        email,
        image,
        speciality,
        employee_user_id,
        employee_user_id as cutter_id,
        shift_type,
        shift_start_time,
        shift_end_time,
        cutter_name
          FROM mv_cutter_schedule mvc
          WHERE
                mvc.store_id = '${store_id}'
                AND (
                  (shift_start_time >= '${startDate}' AND shift_end_time > '${startDate}')
                  OR
                  ('${startDate}' >= shift_start_time AND '${startDate}' <= shift_end_time)
                ) AND mvc.shift_end_time <= '${endDate}' AND mvc.status = 'active' AND mvc.is_deleted = false 
          )
          SELECT d.*,
          json_agg(json_build_object('time_from', slots.slot_start_time, 'time_to', slots.slot_end_time)) AS cutter_availability
          ,GREATEST(d.shift_start_time::timestamp, slots.slot_start_time::timestamp) AS cur_time
          FROM emp_data d
          LEFT JOIN LATERAL (
          SELECT  generate_series(
                    GREATEST(d.shift_start_time::timestamp, date_round('${startDate}', '1 minutes')::timestamp),
                    date_round('${endDate}', '1 minutes')::timestamp,
              '1 minutes'::interval + (0 * interval '1 minute')
            ) slot_start_time,
            generate_series(
              GREATEST(d.shift_start_time::timestamp, date_round('${startDate}', '1 minutes')::timestamp) + (0 * interval '1 minute'),
              date_round('${endDate}', '1 minutes')::timestamp,
              '1 minutes'::interval + (0 * interval '1 minute')
            ) slot_end_time
            
          ) slots
          ON slots.slot_start_time >= d.shift_start_time
                AND slots.slot_start_time <= d.shift_end_time AND slots.slot_end_time <= d.shift_end_time
          GROUP BY slot_start_time, slot_end_time, d.cutter_name, d.cutter_id,
                d.primary_contact,d.email,d.speciality, d.shift_end_time, d.shift_start_time,d.image, d.bio, d.employee_user_id, d.shift_type
          HAVING d.shift_start_time IS NOT NULL AND slots.slot_end_time IS NOT NULL
          ORDER BY slots.slot_start_time, slots.slot_end_time, d.cutter_name ASC
    `;
  }
}
