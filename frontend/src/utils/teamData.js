/**
 * teamData.js — Single source of truth for founder/professional details on the frontend.
 *
 * Photos are imported here once and referenced by name everywhere
 * (About page portrait grid + Schedule page detailed cards).
 *
 * To add a new professional: add an entry to TEAM_DATA.
 * To add a photo: put the file in src/assets/team/ and import it below.
 */

import leaskarPhoto from '../assets/team/leaskar.jpg'
import jeevanPhoto from '../assets/team/jeevan.png'
import abijithPhoto from '../assets/team/abijith.png'
import mohammedPhoto from '../assets/team/mohammed.jpg'

export const TEAM_DATA = [
    {
        name: 'Jeevan KJ',
        role: 'Counselling Psychologist',
        exp: '2+ yrs exp',
        languages: 'Tamil, English',
        areas: ['School Counseling', 'Career Guidance'],
        approach: ['Person-Centered Support', 'Strengths-Based Career Mapping'],
        photo: jeevanPhoto,
    },
    {
        name: 'Leaskar Paulraj DJ',
        role: 'Counselling Psychologist',
        exp: '2+ yrs exp',
        languages: 'Tamil, English',
        areas: ['Family Concerns', 'Disability Coping', 'General Stress'],
        approach: ['CBT', 'PCT', 'Family Counselling'],
        photo: leaskarPhoto,
    },
    {
        name: 'Abijith KB',
        role: 'Counselling Psychologist',
        exp: '2+ yrs exp',
        languages: 'Tamil, Malayalam, English',
        areas: ['Work Stress', 'Work-Life Balance', 'Relationships', 'Academics'],
        approach: ['CBT', 'Person-Centered Therapy', 'Psychoanalytic Therapy'],
        photo: abijithPhoto,
    },
    {
        name: 'Mohammed Muhaiyadeen M',
        role: 'Counselling Psychologist',
        exp: '2+ yrs exp',
        languages: 'Tamil, English',
        areas: ['Relationships', 'Identity', 'Work Stress', 'Academics', 'Professional Growth', 'Anxiety', 'Grief'],
        approach: ['CBT', 'Person-Centered Therapy', 'Couple Counselling'],
        photo: mohammedPhoto,
        // His headshot is tighter than the others — contain scales it down to fit the circle properly
        photoFit: 'contain',
        photoPosition: 'center 45%',
    },
]

/** Lookup by name (case-insensitive, whitespace-tolerant) */
export function getTeamMember(name) {
    if (!name) return null
    const norm = s => s.trim().toLowerCase()
    return TEAM_DATA.find(m => norm(m.name) === norm(name)) || null
}
