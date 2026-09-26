import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus } from "@minecraft/server";
import { PlayerCommandOrigin, VanillaCommand } from "../../lib/canopy/Canopy";
import { stringifyLocation, getRaycastResults, getClosestTarget, calcDistance } from "../../include/utils";

const DISTANCE_ACTIONS = Object.freeze([
    'target',
    'from',
    'to'
]);

const DISTANCE_CONNECTORS = Object.freeze([
    'to'
]);

const MAX_DISTANCE = 64 * 16;

export class DistanceCommand extends VanillaCommand {
    savedLocation;

    constructor() {
        super({
            name: 'canopy:distance',
            description: 'commands.distance',
            enums: [
                {
                    name: 'canopy:distanceAction',
                    values: DISTANCE_ACTIONS
                },
                {
                    name: 'canopy:distanceConnector',
                    values: DISTANCE_CONNECTORS
                }
            ],
            mandatoryParameters: [
                {
                    name: 'canopy:distanceAction',
                    type: CustomCommandParamType.Enum
                }
            ],
            optionalParameters: [
                {
                    name: 'location',
                    type: CustomCommandParamType.Location
                },
                {
                    name: 'canopy:distanceConnector',
                    type: CustomCommandParamType.Enum
                },
                {
                    name: 'location',
                    type: CustomCommandParamType.Location
                }
            ],
            permissionLevel: CommandPermissionLevel.Any,
            allowedSources: [PlayerCommandOrigin],
            aliases: ['canopy:d'],
            callback: (origin, ...args) => this.distanceCommand(origin, ...args),
            wikiDescription: 'Measures distance between locations or to the block or entity you are looking at. '
                + 'Use `target` to measure to your current target, `from [location]` to save a location, '
                + '`to [location]` to measure from the saved location, or `from <location> to [destination]` '
                + 'to measure directly between two points. Omitted locations use your current position. '
                + 'Alias: **`/d`**.'
        });
    }

    distanceCommand(origin, action, location, connector, destination) {
        const player = origin.getSource();
        let message;

        if (action === 'target') {
            if (location || connector || destination)
                return this.invalidUsage(origin);
            message = targetDistance(player);
        } else if (action === 'from') {
            if (destination && connector !== 'to')
                return this.invalidUsage(origin);

            if (connector === void 0) {
                if (destination)
                    return this.invalidUsage(origin);
                message = this.saveLocation(player, location);
            } else if (connector === 'to' && location) {
                message = getCompleteOutput(location, destination ?? player.location);
            } else {
                return this.invalidUsage(origin);
            }
        } else if (action === 'to') {
            if (connector || destination)
                return this.invalidUsage(origin);
            message = this.calculateFromSavedLocation(player, location);
        } else {
            return {
                status: CustomCommandStatus.Failure,
                message: 'commands.generic.invalidaction'
            };
        }

        origin.sendMessage(message);
        return { status: CustomCommandStatus.Success };
    }

    saveLocation(player, location) {
        const source = location ?? player.location;
        this.savedLocation = {
            x: source.x,
            y: source.y,
            z: source.z
        };

        return {
            translate: 'commands.distance.from.success',
            with: [stringifyLocation(this.savedLocation)]
        };
    }

    calculateFromSavedLocation(player, destination) {
        if (!this.savedLocation) {
            return {
                translate: 'commands.distance.to.fail.nosave',
                with: ['/canopy:']
            };
        }

        return getCompleteOutput(
            this.savedLocation,
            destination ?? player.location
        );
    }

    invalidUsage(origin) {
        origin.sendMessage({
            translate: 'commands.generic.usage',
            with: ['/canopy:distance <target|from|to> [location] [to] [location]']
        });

        return { status: CustomCommandStatus.Failure };
    }
}

function targetDistance(player) {
    const playerLocation = player.getHeadLocation();
    let targetLocation;

    const { blockRayResult, entityRayResult } = getRaycastResults(player, MAX_DISTANCE);

    if (!blockRayResult && !entityRayResult[0])
        return { translate: 'commands.distance.target.notfound' };

    const target = getClosestTarget(player, blockRayResult, entityRayResult);

    try {
        targetLocation = target.location;
    } catch {
        return { translate: 'commands.distance.target.notfound' };
    }

    return getCompleteOutput(playerLocation, targetLocation);
}

function calculateDistances(locationOne, locationTwo) {
    const cartesianDistance = calcDistance(locationOne, locationTwo, true);
    const cylindricalDistance = calcDistance(locationOne, locationTwo, false);
    const manhattanDistance = Math.abs(locationOne.x - locationTwo.x)
        + Math.abs(locationOne.y - locationTwo.y)
        + Math.abs(locationOne.z - locationTwo.z);

    return {
        cartesianDistance,
        cylindricalDistance,
        manhattanDistance
    };
}

function getCompleteOutput(locationOne, locationTwo) {
    const {
        cartesianDistance,
        cylindricalDistance,
        manhattanDistance
    } = calculateDistances(locationOne, locationTwo);

    return {
        rawtext: [
            {
                text: `§7Distance from §a${stringifyLocation(locationOne)}§7 to §a${stringifyLocation(locationTwo)}§7:\n`
            },
            {
                rawtext: [
                    {
                        translate: 'commands.distance.cartesian',
                        with: [cartesianDistance.toFixed(3)]
                    },
                    { text: '\n' },
                    {
                        translate: 'commands.distance.cylindrical',
                        with: [cylindricalDistance.toFixed(3)]
                    },
                    { text: '\n' },
                    {
                        translate: 'commands.distance.manhattan',
                        with: [manhattanDistance.toFixed(3)]
                    },
                    { text: '\n' }
                ]
            }
        ]
    };
}

export const distanceCommand = new DistanceCommand();

export {
    DISTANCE_ACTIONS,
    DISTANCE_CONNECTORS
};
