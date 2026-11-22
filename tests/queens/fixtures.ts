import type { QueensShape } from "@/games/queens/engine";

/** 5x5 boards drawn by hand. Each row of digits is a row of the board, and each digit is a region. */
export const shape = (...rows: string[]): QueensShape => ({ size: rows.length, regions: rows.flatMap((row) => [...row].map(Number)) });

/** Region 0 fills the first three cells of the top row. */
export const CONFINED_REGION = shape("00011", "22211", "22233", "44233", "44433");
/** The left column belongs to region 0, which also owns one more cell. */
export const CONFINED_LINE = shape("00111", "02211", "02233", "04233", "04443");
/** Regions 0 and 1 fit inside the two top rows. */
export const REGION_GROUP = shape("00112", "00112", "33322", "34442", "34442");
/** Every region is a column, so any spread of non-touching queens solves it. */
export const COLUMNS = shape("01234", "01234", "01234", "01234", "01234");
